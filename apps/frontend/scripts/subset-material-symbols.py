#!/usr/bin/env python3
"""
Erzeugt das selbst gehostete Material-Symbols-Outlined-WOFF2-Subset
(apps/frontend/src/assets/fonts/material-symbols-outlined.woff2) aus dem
installierten npm-Paket `material-symbols`.

Beinhaltet alle in `apps/frontend/src` verwendeten Icon-Ligaturen inklusive
ihrer `.fill`-Varianten (für `font-variation-settings: 'FILL' 1`) sowie
gängige UI-/MatDatepicker-/MatPaginator-Basis-Icons.
"""
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

REPO_ROOT = Path(__file__).resolve().parents[3]
SOURCE_FONT = REPO_ROOT / "node_modules" / "material-symbols" / "material-symbols-outlined.woff2"
OUTPUT_FONT = REPO_ROOT / "apps" / "frontend" / "src" / "assets" / "fonts" / "material-symbols-outlined.woff2"
APP_SRC = REPO_ROOT / "apps" / "frontend" / "src" / "app"

BASELINE_ICONS = {
    "abc", "accessibility", "accessibility_new", "add", "add_circle", "adjust",
    "admin_panel_settings", "analytics", "api", "apps", "archive", "arrow_back",
    "arrow_downward", "arrow_Drop_down", "arrow_drop_down", "arrow_drop_up",
    "arrow_forward", "arrow_upward", "article", "auto_awesome", "badge", "ballot",
    "bar_chart", "bolt", "bubble_chart", "cable", "calculate", "calendar_today",
    "campaign", "cancel", "category", "celebration", "center_focus_strong",
    "chat_bubble", "check", "check_box", "check_box_outline_blank", "check_circle",
    "checklist", "chevron_left", "chevron_right", "child_care", "circle", "close",
    "cloud", "cloud_off", "code", "compare_arrows", "content_copy", "contrast",
    "dark_mode", "delete", "delete_forever", "description", "devices", "devices_off",
    "done", "done_all", "download", "drag_indicator", "east", "edit", "edit_calendar",
    "edit_note", "edit_square", "enhanced_encryption", "equalizer", "error", "event",
    "event_busy", "expand_less", "expand_more", "fact_check", "finance", "first_page",
    "fitness_center", "flag", "format_bold", "format_italic", "format_list_bulleted",
    "format_list_numbered", "format_quote", "forum", "fullscreen", "fullscreen_exit",
    "functions", "gavel", "group", "group_add", "groups", "help", "highlight",
    "history", "home", "hourglass_empty", "hourglass_top", "how_to_vote", "hub",
    "image", "info", "insights", "integration_instructions", "keep", "keep_off",
    "key", "keyboard", "keyboard_arrow_down", "keyboard_arrow_left",
    "keyboard_arrow_right", "keyboard_arrow_up", "label", "lan", "language",
    "last_page", "leaderboard", "library_books", "library_music", "light_mode",
    "lightbulb", "linear_scale", "link", "link_off", "local_fire_department", "lock",
    "login", "logout", "manage_search", "mark_as_unread", "mark_email_read",
    "mark_email_unread", "meeting_room", "memory", "menu", "menu_book",
    "military_tech", "monitor", "monitoring", "more_horiz", "more_vert",
    "neurology", "newspaper", "note_add", "notes", "open_in_full", "open_in_new",
    "outbox", "pause", "pause_circle", "percent", "person", "person_off",
    "play_arrow", "play_circle", "playlist_add", "podium", "present_to_all",
    "priority_high", "privacy_tip", "psychology", "psychology_alt", "push_pin",
    "qr_code_2", "quiz", "radio_button_checked", "radio_button_unchecked",
    "rate_review", "refresh", "remove", "replay", "restart_alt", "router",
    "rule", "save", "schedule", "school", "science", "search", "search_off",
    "sentiment_satisfied", "settings", "share", "shuffle", "skip_next",
    "social_leaderboard", "speed", "star", "star_half", "stop",
    "stop_screen_share", "storage", "straighten", "stream", "summarize",
    "swap_horiz", "swap_vert", "sync", "sync_alt", "sync_problem",
    "system_update_alt", "table_view", "task_alt", "theater_comedy",
    "thumb_down", "thumb_up", "thumbs_up_down", "timer", "timer_off", "title",
    "touch_app", "traffic", "trending_up", "trophy", "tune", "unarchive",
    "undo", "update", "upload", "upload_file", "verified", "visibility",
    "visibility_off", "volume_off", "volume_up", "wand_stars", "warning",
    "web_asset", "wifi_off", "work",
}


def scan_app_icons() -> set[str]:
    found = set(BASELINE_ICONS)
    mat_icon_re = re.compile(
        r'<mat-icon\b(?:"[^"]*"|\'[^\']*\'|[^>])*>([\s\S]*?)</mat-icon\s*>'
    )
    token_re = re.compile(r"\b([a-z][a-z0-9_]{1,40})\b")
    for path in APP_SRC.rglob("*"):
        if path.suffix not in (".html", ".ts") or path.name.endswith(".spec.ts"):
            continue
        text = path.read_text(encoding="utf-8")
        for match in mat_icon_re.finditer(text):
            for tok in token_re.findall(match.group(1)):
                found.add(tok)
    return found


def main() -> None:
    if not SOURCE_FONT.exists():
        print(f"Fehler: Quell-Font nicht gefunden: {SOURCE_FONT}", file=sys.stderr)
        sys.exit(1)

    font = TTFont(str(SOURCE_FONT))
    all_glyphs = set(font.getGlyphOrder())
    cmap = font.getBestCmap()

    candidates = scan_app_icons()
    keep_glyphs = {".notdef", "space"}
    for ch in "abcdefghijklmnopqrstuvwxyz0123456789_":
        if ord(ch) in cmap:
            keep_glyphs.add(cmap[ord(ch)])

    included_icons = []
    for icon in sorted(candidates):
        if icon in all_glyphs:
            keep_glyphs.add(icon)
            included_icons.append(icon)
        fill_name = f"{icon}.fill"
        if fill_name in all_glyphs:
            keep_glyphs.add(fill_name)

    with tempfile.TemporaryDirectory() as tmpdir:
        glyphs_file = Path(tmpdir) / "glyphs.txt"
        subset_var_file = Path(tmpdir) / "subset-var.woff2"
        glyphs_file.write_text("\n".join(sorted(keep_glyphs)), encoding="utf-8")

        pyftsubset_cmd = [
            sys.executable,
            "-m",
            "fontTools.subset",
            str(SOURCE_FONT),
            f"--glyphs-file={glyphs_file}",
            "--layout-features=*",
            "--no-layout-closure",
            "--flavor=woff2",
            f"--output-file={subset_var_file}",
        ]
        subprocess.run(pyftsubset_cmd, check=True)

        subset_font = TTFont(str(subset_var_file))
        instanced_font = instantiateVariableFont(
            subset_font, {"wght": 400, "GRAD": 0, "opsz": 24}
        )
        instanced_font.flavor = "woff2"
        OUTPUT_FONT.parent.mkdir(parents=True, exist_ok=True)
        instanced_font.save(str(OUTPUT_FONT))

    size_kb = os.path.getsize(OUTPUT_FONT) / 1024
    print(
        f"Material Symbols Subset erzeugt: {OUTPUT_FONT.relative_to(REPO_ROOT)} "
        f"({len(included_icons)} Icons, {len(keep_glyphs)} Glyphen, {size_kb:.1f} KB)"
    )


if __name__ == "__main__":
    main()
