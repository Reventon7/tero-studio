from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

root = Path('dist').resolve()
pending = [root / 'index.html']
visited = set()


class Check(HTMLParser):
    def __init__(self, page):
        super().__init__()
        self.page = page

    def handle_starttag(self, tag, attrs):
        for key, value in attrs:
            if key not in ('src', 'href') or not value:
                continue
            url = urlsplit(value)
            if url.scheme or url.netloc or not url.path:
                continue
            path = unquote(url.path)
            target = (root / path.lstrip('/') if path.startswith('/') else self.page.parent / path).resolve()
            if target == root:
                target /= 'index.html'
            elif not target.suffix:
                target = target.with_suffix('.html')
            assert target.is_relative_to(root) and target.is_file(), (self.page, value)
            if target.suffix == '.html' and target not in visited:
                pending.append(target)


while pending:
    page = pending.pop()
    if page in visited:
        continue
    visited.add(page)
    Check(page).feed(page.read_text(encoding='utf-8'))

print(f'All asset and page references valid across {len(visited)} pages')
