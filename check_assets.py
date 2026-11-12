from pathlib import Path
from html.parser import HTMLParser
class Check(HTMLParser):
 def handle_starttag(self,t,attrs):
  for k,v in attrs:
   if k in ('src','href') and v and not v.startswith(('#','http')):
    assert (Path('dist')/v).exists(),v
Check().feed(Path('dist/index.html').read_text(encoding='utf-8'))
print('All HTML asset references valid')
