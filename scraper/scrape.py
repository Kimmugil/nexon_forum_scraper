import asyncio
import base64
import json
import os
import re
from dataclasses import asdict, dataclass

import gspread
from google.oauth2.service_account import Credentials
from playwright.async_api import Page, async_playwright

NEXON_FORUM = "https://forum.nexon.com"

GAME_NAMES = {
    "maplestoryidle-kr": "메이플 키우기",
    "azurpromilia": "아주르 프로밀리아",
    "bluearchive": "블루 아카이브",
    "baramy": "바람의나라: 연",
    "fcmobile": "FC 모바일",
    "kartrush": "카트라이더 러쉬플러스",
    "v4kr": "V4",
}

SHEET_HEADERS = ["thread_id", "headline", "title", "author", "date", "view_count", "likes", "comments", "url", "content"]

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]


@dataclass
class Post:
    thread_id: str
    headline: str
    title: str
    author: str
    date: str
    view_count: str
    likes: str
    comments: str
    url: str
    content: str = ""


def build_gspread_client() -> gspread.Client:
    raw = os.environ["GOOGLE_SERVICE_ACCOUNT_JSON"]
    try:
        sa_info = json.loads(base64.b64decode(raw).decode())
    except Exception:
        sa_info = json.loads(raw)
    creds = Credentials.from_service_account_info(sa_info, scopes=SCOPES)
    return gspread.authorize(creds)


def get_or_create_spreadsheet(gc: gspread.Client, game_slug: str) -> gspread.Spreadsheet:
    title = f"[넥슨포럼] {GAME_NAMES.get(game_slug, game_slug)}"
    try:
        return gc.open(title)
    except gspread.SpreadsheetNotFound:
        ss = gc.create(title)
        ss.share(None, perm_type="anyone", role="reader")
        owner_email = os.environ.get("GOOGLE_OWNER_EMAIL")
        if owner_email:
            ss.share(owner_email, perm_type="user", role="writer")
        return ss


def get_or_create_worksheet(ss: gspread.Spreadsheet, board_id: int, board_name: str) -> gspread.Worksheet:
    title = f"{board_name} ({board_id})"
    try:
        return ss.worksheet(title)
    except gspread.WorksheetNotFound:
        ws = ss.add_worksheet(title=title, rows=5000, cols=len(SHEET_HEADERS))
        ws.append_row(SHEET_HEADERS, value_input_option="RAW")
        return ws


def get_existing_thread_ids(ws: gspread.Worksheet) -> set[str]:
    values = ws.col_values(1)
    return set(values[1:])


def append_posts(ws: gspread.Worksheet, posts: list[Post]) -> None:
    if not posts:
        return
    rows = [
        [p.thread_id, p.headline, p.title, p.author, p.date, p.view_count, p.likes, p.comments, p.url, p.content]
        for p in posts
    ]
    ws.append_rows(rows, value_input_option="RAW")


async def get_total_pages(page: Page) -> int:
    el = await page.query_selector(".board-list.list-paging")
    if not el:
        return 1
    text = (await el.inner_text()).strip()
    try:
        return int(text.split("/")[1].strip().split()[0])
    except Exception:
        return 1


async def scrape_list_page(page: Page, base_url: str, board_id: int, page_num: int) -> list[Post]:
    url = f"{base_url}/board_list?board={board_id}&page={page_num}"
    await page.goto(url, wait_until="networkidle", timeout=30000)

    posts = []
    for item in await page.query_selector_all(".type-list li"):
        try:
            link_el = await item.query_selector("a")
            href = (await link_el.get_attribute("href")) if link_el else ""
            thread_id = (await link_el.get_attribute("data-thread")) if link_el else ""
            full_url = f"{base_url}/{href}" if href else ""

            headline_el = await item.query_selector("h3 .headline")
            headline = (await headline_el.inner_text()).strip() if headline_el else ""

            title_parts = []
            for span in await item.query_selector_all("h3 span"):
                cls = (await span.get_attribute("class")) or ""
                if "headline" not in cls:
                    t = (await span.inner_text()).strip()
                    if t:
                        title_parts.append(t)
            title = " ".join(title_parts)

            author = ""
            writer_el = await item.query_selector(".writer")
            if writer_el:
                author = (await writer_el.inner_text()).strip()

            date = ""
            date_el = await item.query_selector(".date")
            if date_el:
                date = (await date_el.inner_text()).strip()

            view_count = (await (await item.query_selector(".count-read")).inner_text()).strip() if await item.query_selector(".count-read") else "0"
            likes = (await (await item.query_selector(".count-likes")).inner_text()).strip() if await item.query_selector(".count-likes") else "0"
            comments = (await (await item.query_selector(".count-comment")).inner_text()).strip() if await item.query_selector(".count-comment") else "0"

            posts.append(Post(
                thread_id=thread_id or "",
                headline=headline,
                title=title,
                author=author,
                date=date,
                view_count=view_count,
                likes=likes,
                comments=comments,
                url=full_url,
            ))
        except Exception as e:
            print(f"[경고] 아이템 파싱 오류: {e}")

    return posts


async def fetch_content(page: Page, post: Post) -> str:
    if not post.url:
        return ""
    try:
        await page.goto(post.url, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(500)
        for sel in [".contents-box", ".view-box", ".post-content", ".post-body", ".article-body"]:
            el = await page.query_selector(sel)
            if el:
                text = (await el.inner_text()).strip()
                if text:
                    return text
    except Exception as e:
        print(f"[경고] 본문 스크래핑 실패 ({post.thread_id}): {e}")
    return ""


def save_sheet_url(game_slug: str, url: str) -> None:
    path = os.path.join(os.path.dirname(__file__), "..", "data", "sheets.json")
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        data = {}
    data[game_slug] = url
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


async def main() -> None:
    game_slug = os.environ["GAME_SLUG"]
    board_id = int(os.environ["BOARD_ID"])
    board_name = os.environ.get("BOARD_NAME", str(board_id))
    base_url = f"{NEXON_FORUM}/{game_slug}"

    gc = build_gspread_client()
    ss = get_or_create_spreadsheet(gc, game_slug)
    ws = get_or_create_worksheet(ss, board_id, board_name)
    existing_ids = get_existing_thread_ids(ws)
    print(f"기존 게시글 수: {len(existing_ids)}")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            locale="ko-KR",
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
        )
        page = await context.new_page()

        await page.goto(f"{base_url}/board_list?board={board_id}", wait_until="networkidle", timeout=30000)
        total_pages = await get_total_pages(page)
        print(f"총 {total_pages} 페이지")

        new_posts: list[Post] = []
        for page_num in range(1, total_pages + 1):
            print(f"[{page_num}/{total_pages}] 목록 수집 중...")
            posts = await scrape_list_page(page, base_url, board_id, page_num)
            fresh = [p for p in posts if p.thread_id not in existing_ids]

            if not fresh and page_num > 1:
                print("이미 수집된 페이지에 도달. 중단.")
                break

            new_posts.extend(fresh)
            await asyncio.sleep(1)

        print(f"신규 게시글: {len(new_posts)}개")

        for i, post in enumerate(new_posts, 1):
            print(f"  [{i}/{len(new_posts)}] {post.title[:50]}...")
            post.content = await fetch_content(page, post)
            await asyncio.sleep(1)

        await browser.close()

    append_posts(ws, new_posts)
    save_sheet_url(game_slug, ss.url)

    print(f"완료. 스프레드시트: {ss.url}")
    print(f"SHEET_URL={ss.url}")


if __name__ == "__main__":
    asyncio.run(main())
