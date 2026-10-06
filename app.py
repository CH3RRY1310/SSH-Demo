from __future__ import annotations

import re
from pathlib import Path
from urllib.parse import urlparse

import streamlit as st
import streamlit.components.v1 as components


ROOT = Path(__file__).parent
DIST = ROOT / "dist"


def _read_built_asset(url: str) -> str:
    parsed_url = urlparse(url)
    if parsed_url.scheme or parsed_url.netloc:
        raise ValueError(f"Expected a local built asset, got {url!r}.")

    asset_path = (DIST / parsed_url.path.lstrip("/")).resolve()
    try:
        asset_path.relative_to(DIST.resolve())
    except ValueError as error:
        raise ValueError(f"Built asset path escapes the dist directory: {url!r}.") from error

    if not asset_path.is_file():
        raise FileNotFoundError(f"Built app asset is missing: {asset_path}")
    return asset_path.read_text(encoding="utf-8")


def _inline_built_assets() -> str:
    index_path = DIST / "index.html"
    if not index_path.is_file():
        raise FileNotFoundError(
            "The built React app was not found. Run `npm run build` before starting Streamlit."
        )

    html = index_path.read_text(encoding="utf-8")
    script_pattern = re.compile(
        r'<script\b[^>]*\bsrc="(?P<url>[^"]+\.js)"[^>]*>\s*</script>',
        re.IGNORECASE,
    )
    style_pattern = re.compile(
        r'<link\b(?=[^>]*\brel="stylesheet")(?=[^>]*\bhref="(?P<url>[^"]+\.css)")[^>]*>',
        re.IGNORECASE,
    )

    script_match = script_pattern.search(html)
    style_match = style_pattern.search(html)
    if script_match is None or style_match is None:
        raise ValueError(
            "The built index must reference one JavaScript bundle and one CSS bundle."
        )

    script = _read_built_asset(script_match.group("url"))
    style = _read_built_asset(style_match.group("url"))
    html = script_pattern.sub(
        lambda _: f"<script type=\"module\">{script}</script>", html, count=1
    )
    html = style_pattern.sub(lambda _: f"<style>{style}</style>", html, count=1)
    html = re.sub(r'<link\b[^>]*\brel="icon"[^>]*>', "", html, flags=re.IGNORECASE)
    return html


st.set_page_config(
    page_title="Smart Authentication & Login Management System",
    page_icon="🔐",
    layout="wide",
    initial_sidebar_state="collapsed",
)
st.markdown(
    """
    <style>
    [data-testid="stHeader"], [data-testid="stToolbar"], footer { display: none; }
    [data-testid="stAppViewContainer"] .main .block-container {
        max-width: none;
        padding: 0;
    }
    </style>
    """,
    unsafe_allow_html=True,
)
components.html(_inline_built_assets(), height=960, scrolling=True)
