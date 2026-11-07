"""Regenerate static cards after editing assets/projects.json or certificates.json.
No website build or dependencies required: python3 tools/render_content.py
All visitor-facing content remains available without JavaScript.
"""
from pathlib import Path
from html import escape
import json
from datetime import date

ROOT = Path(__file__).resolve().parents[1]
def e(value): return escape(str(value), quote=True)
def external(url): return ' target="_blank" rel="noopener noreferrer"' if url.startswith('https:') else ''
projects = json.loads((ROOT / 'assets/projects.json').read_text())
certificates = json.loads((ROOT / 'assets/certificates.json').read_text())
project_cards = []
for p in projects:
    if p.get('spotlight') is False:
        continue
    links = ''.join(f'<a href="{e(url)}"{external(url)} aria-label="{e(label)} — {e(p["title"])}">{e(label)} <span aria-hidden="true">↗</span></a>' for label, url in p['links'])
    tags = ''.join(f'<li>{e(tag)}</li>' for tag in p['technologies'])
    showcase = p.get('showcase')
    showcase_kind = showcase.get('kind', 'twogethera') if showcase else None
    if p['id'] == 'hicool':
        image_content = f'''<div class="industrial-showcase" aria-hidden="true">
        <span class="industrial-kicker">HiCOOL PH <i>·</i> COLD STORAGE &amp; ICE SUPPLY</span>
        <div class="industrial-laptop">
          <div class="industrial-screen"><img src="{e(p['image'])}" width="1200" height="750" loading="lazy" decoding="async" alt="" data-fallback="HiCOOL PH screenshot unavailable. Use the project link to explore the website."></div>
          <span class="industrial-laptop-base"></span>
        </div>
        <span class="industrial-caption">Website presentation <i aria-hidden="true">↗</i></span>
      </div>'''
    elif showcase_kind == 'mindful':
        image_content = f'''<div class="mindful-showcase" aria-hidden="true">
        <div class="mindful-showcase-copy">
          <p class="mindful-showcase-kicker">Mindful Journal</p>
          <p class="mindful-showcase-headline">{e(showcase['headline'])}</p>
          <p class="mindful-showcase-caption">Write · Reflect · Revisit</p>
        </div>
        <div class="mindful-screen-gallery">
          <div class="mindful-phone mindful-phone--home">
            <span class="mindful-phone-speaker"></span>
            <img src="{e(showcase['image'])}" width="519" height="1050" loading="lazy" alt="">
          </div>
          <div class="mindful-phone mindful-phone--calendar">
            <span class="mindful-phone-speaker"></span>
            <img src="{e(showcase['calendarImage'])}" width="513" height="1050" loading="lazy" alt="">
          </div>
        </div>
      </div>'''
    elif showcase_kind == 'sbaa':
        image_content = f'''<div class="sbaa-showcase" aria-hidden="true">
        <div class="sbaa-devices">
          <div class="sbaa-laptop">
            <div class="sbaa-browser">
              <div class="sbaa-browser-bar"><span class="sbaa-browser-dots" aria-hidden="true"><i></i><i></i><i></i></span><span>SBAA School Portal</span><span class="sbaa-browser-domain">Academic preview</span></div>
              <img src="{e(showcase['image'])}" width="1400" height="752" loading="lazy" alt="">
            </div>
            <span class="sbaa-laptop-base"></span>
          </div>
          <div class="sbaa-phone"><img src="{e(showcase['signInImage'])}" width="1200" height="750" loading="lazy" alt=""></div>
        </div>
        <span class="sbaa-data-note">Interface preview <i>·</i> fictional demo data</span>
      </div>'''
    elif showcase:
        image_content = f'''<div class="product-showcase" aria-label="Twogethera mobile application preview">
        <img class="product-showcase-capture" src="{e(showcase['capture'])}" width="2396" height="1426" loading="lazy" alt="" aria-hidden="true">
        <div class="product-showcase-copy">
          <img class="product-showcase-icon" src="{e(showcase['icon'])}" width="64" height="64" loading="lazy" alt="{e(showcase['iconAlt'])}">
          <p class="product-showcase-kicker">{e(showcase['kicker'])}</p>
          <p class="product-showcase-tagline">{e(showcase['tagline'])}</p>
          <span class="product-showcase-platform">Flutter · iOS · Android · Web</span>
        </div>
        <div class="product-phone" aria-hidden="true">
          <span class="product-phone-speaker"></span>
          <img src="{e(showcase['screen'])}" width="390" height="844" loading="lazy" alt="">
        </div>
        <span class="product-showcase-caption">{e(showcase['caption'])}</span>
      </div>'''
    else:
        image_content = f'''<img
                  src="{e(p['image'])}"
                  width="1200"
                  height="750"
                  loading="lazy"
                  alt="{e(p['alt'])}"
                  data-fallback="Project screenshot unavailable. Use the project link to explore the work."
              />'''
    showcase_class = {
        'hicool': ' project-image--hicool',
        'mindful': ' project-image--mindful',
        'sbaa': ' project-image--sbaa',
        'twogethera': ' project-image--product',
    }.get(showcase_kind, '')
    showcase_headline = f'<p class="project-showcase-headline">{e(showcase["headline"])}</p>' if showcase_kind in ('mindful', 'sbaa') else ''
    feature_items = ''.join(f'<li>{e(feature)}</li>' for feature in showcase.get('features', [])) if showcase_kind in ('mindful', 'sbaa') else ''
    feature_list = f'<ul class="project-features" aria-label="Selected project features">{feature_items}</ul>' if feature_items else ''
    visual_label = {
        'hicool': 'Explore HiCOOL PH website work',
        'sbaa': 'Preview the SBAA School Portal administrator dashboard; shown values are fictional demonstration data',
        'mindful-journal': 'Preview Mindful Journal home and calendar screens',
        'twogethera': 'Preview Twogethera — a private shared planning app',
    }.get(p['id'], 'Explore ' + e(p['title']))
    card = f'''<article class="project-card reveal" data-category="{e(p['category'])}" data-project-id="{e(p['id'])}">
      <a class="project-image{showcase_class}" href="{e(p['links'][0][1])}"{external(p['links'][0][1])} aria-label="{visual_label}">{image_content}</a>
      <div class="project-body"><div class="project-meta"><span class="project-category">{e(p['label'])}</span><span class="project-state">{e(p['status'])}</span></div><h3>{e(p['title'])}</h3>{showcase_headline}<p class="project-description">{e(p['description'])}</p><p class="contribution"><strong>My contribution:</strong> {e(p['contribution'])}</p>{feature_list}<ul class="tags" aria-label="Technologies">{tags}</ul><div class="project-links">{links}</div></div>
    </article>'''
    project_cards.append(card)
certificate_cards = []
for c in certificates:
    title = e(c['title'])
    attrs = f'data-document="{e(c["image"])}" data-pdf="{e(c["pdf"])}" data-title="{title}" data-kind="image"'
    verify = f'<a href="{e(c["verify"])}" target="_blank" rel="noopener noreferrer" aria-label="Verify credential: {title}">Verify Credential ↗</a>' if c.get('verify') else ''
    if c.get('verificationStatus') == 'unavailable':
        verify = f'<span class="certificate-date">{e(c["verificationNote"])}</span>'
    context = f'<p class="certificate-issuer">{e(c["context"])}</p>' if c.get('context') else ''
    when = date.fromisoformat(c['date'])
    date_label = when.strftime('%B ') + str(when.day) + when.strftime(', %Y')
    card = f'''<article class="certificate-card reveal" data-category="{e(c['category'])}"><a class="certificate-image" href="{e(c['pdf'])}" {attrs} aria-label="View certificate: {title}"><img src="{e(c['image'])}" loading="lazy" width="640" height="450" alt="{e(c['alt'])}" data-fallback="Certificate preview unavailable; open the original PDF."></a><div class="certificate-body"><p class="certificate-category">{e(c['category'])}</p><h3>{title}</h3>{context}<p class="certificate-issuer">{e(c['issuer'])}</p><p class="certificate-date"><time datetime="{e(c['date'])}">{date_label}</time></p><div class="certificate-links"><a class="text-link" href="{e(c['pdf'])}" {attrs}>View Certificate <span aria-hidden="true">↗</span></a>{verify}</div></div></article>'''
    certificate_cards.append(card)
page = ROOT / 'index.html'
html = page.read_text()
for marker, cards in [('PROJECTS', project_cards), ('CERTIFICATES', certificate_cards)]:
    start, end = f'<!-- {marker}_START -->', f'<!-- {marker}_END -->'
    before, rest = html.split(start, 1)
    _, after = rest.split(end, 1)
    html = before + start + '\n' + '\n'.join(cards) + '\n' + end + after
page.write_text(html)
print(f'Rendered {len(project_cards)} project cards and {len(certificate_cards)} certificate cards.')
