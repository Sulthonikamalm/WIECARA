from html.parser import HTMLParser
from pathlib import Path
import argparse
import json
import re
import sys


ROOT_DIR = Path(__file__).resolve().parents[1]
DICTIONARY_PATH = ROOT_DIR / "assets/js/shared/i18n-dictionary.js"
TEXT_KEY_PATTERN = re.compile(r'"((?:[^"\\]|\\.)+)"\s*:')
IGNORED_PREFIXES = (
    "http",
    "width=device",
    "0; url=",
)


class HtmlTextParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.skip_depth = 0
        self.items = []

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "noscript"):
            self.skip_depth += 1

        attr_map = dict(attrs)
        for name, value in attrs:
            if name not in ("placeholder", "title", "aria-label", "alt", "content"):
                continue
            if name == "content" and attr_map.get("name") != "description":
                continue
            self._append(value)

    def handle_endtag(self, tag):
        if tag in ("script", "style", "noscript") and self.skip_depth:
            self.skip_depth -= 1

    def handle_data(self, data):
        if not self.skip_depth:
            self._append(data)

    def _append(self, value):
        text = " ".join(str(value or "").split()).strip()
        if text and any(char.isalpha() for char in text):
            self.items.append(text)


def load_dictionary_keys():
    content = DICTIONARY_PATH.read_text(encoding="utf-8")
    keys = set()
    for raw_key in TEXT_KEY_PATTERN.findall(content):
        try:
            keys.add(json.loads(f'"{raw_key}"'))
        except json.JSONDecodeError:
            keys.add(raw_key)
    return keys


def iter_html_texts():
    for path in sorted(ROOT_DIR.rglob("*.html")):
        parser = HtmlTextParser()
        parser.feed(path.read_text(encoding="utf-8", errors="ignore"))
        for text in parser.items:
            if text.startswith(IGNORED_PREFIXES):
                continue
            yield path.relative_to(ROOT_DIR), text


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    parser = argparse.ArgumentParser(description="Audit cakupan kamus i18n WIECARA.")
    parser.add_argument("--strict", action="store_true", help="Keluar dengan kode 1 jika ada teks belum tercakup.")
    args = parser.parse_args()

    keys = load_dictionary_keys()
    missing = {}
    for path, text in iter_html_texts():
        if text not in keys:
            missing.setdefault(text, set()).add(str(path))

    print(f"Total teks unik belum tercakup: {len(missing)}")
    for text in sorted(missing):
        locations = ", ".join(sorted(missing[text])[:3])
        print(f"- {text} [{locations}]")

    if args.strict and missing:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
