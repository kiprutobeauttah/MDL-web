const REPO = "kiprutobeauttah/MDL";
const API = `https://api.github.com/repos/${REPO}`;
const RELEASES_PAGE = `https://github.com/${REPO}/releases`;
const README = `https://github.com/${REPO}#setup`;
const FALLBACK_VERSION = "v1.2.0";

const PLATFORMS = [
  { key: "windows", title: "Windows", glyph: "W", match: /\.(msi|exe)$/i },
  { key: "macos", title: "macOS", glyph: "A", match: /\.(dmg|app\.tar\.gz)$/i },
  { key: "linux", title: "Linux", glyph: "L", match: /\.(appimage|deb|rpm|tar\.gz|tgz)$/i },
];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function icon(id) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "icon");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `#${id}`);
  svg.appendChild(use);
  return svg;
}

function link(href, className) {
  const node = el("a", className);
  node.href = href;
  node.target = "_blank";
  node.rel = "noopener";
  return node;
}

function formatSize(bytes) {
  if (!bytes) return "";
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

function formatDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const ALLOWED_TAGS = new Set([
  "P", "H1", "H2", "H3", "H4", "H5", "H6", "UL", "OL", "LI", "BR", "HR",
  "STRONG", "EM", "DEL", "CODE", "PRE", "BLOCKQUOTE", "A",
]);

function sanitizeHTML(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const walk = (node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 1) {
        if (!ALLOWED_TAGS.has(child.tagName)) {
          child.remove();
          continue;
        }
        for (const attr of Array.from(child.attributes)) {
          const name = attr.name.toLowerCase();
          const value = attr.value.trim().toLowerCase();
          const safeHref =
            name === "href" &&
            /^(https?:\/\/|mailto:|#)/.test(value);
          if (!safeHref && name !== "title") child.removeAttribute(attr.name);
        }
        if (child.tagName === "A") {
          child.setAttribute("target", "_blank");
          child.setAttribute("rel", "noopener");
        }
        walk(child);
      } else if (child.nodeType !== 3) {
        child.remove();
      }
    }
  };
  walk(doc.body);
  return doc.body.innerHTML;
}

async function fetchJSON(url) {
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/vnd.github+json, application/vnd.github.html+json" },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function setVersion(release) {
  const badge = document.getElementById("version-badge");
  const text = document.getElementById("version-text");
  const hero = document.getElementById("hero-download");

  if (release && release.tag_name) {
    text.textContent = `Latest release · ${release.tag_name}`;
    hero.href = release.html_url || RELEASES_PAGE;
  } else {
    text.textContent = `Current version · ${FALLBACK_VERSION}`;
    hero.href = RELEASES_PAGE;
  }
  badge.classList.add("ready");
}

function renderPlatforms(release) {
  const grid = document.getElementById("platform-grid");
  grid.replaceChildren();
  const assets = release && Array.isArray(release.assets) ? release.assets : [];
  const used = new Set();

  for (const platform of PLATFORMS) {
    const card = el("article", "platform-card");
    const head = el("div", "platform-head");
    head.append(el("span", "platform-icon", platform.glyph), el("h3", null, platform.title));
    card.append(head);

    const matches = assets.filter((a) => !used.has(a.id) && platform.match.test(a.name));
    if (matches.length) {
      card.append(el("p", "meta", `Available in ${release.tag_name}`));
      const list = el("div", "assets");
      matches.slice(0, 4).forEach((asset) => {
        used.add(asset.id);
        const row = link(asset.browser_download_url, "asset");
        row.append(icon("i-download"), el("span", "asset-name", asset.name));
        const size = formatSize(asset.size);
        if (size) row.append(el("span", "asset-size", size));
        list.append(row);
      });
      card.append(list);
    } else {
      card.append(el("p", "meta", "Installers coming soon"));
      const empty = el("p", "no-asset");
      empty.append("No packaged build yet — ");
      empty.append(link(README, "text-link", "build from source"));
      card.append(empty);
    }

    grid.append(card);
  }
}

function renderReleases(releases) {
  const list = document.getElementById("release-list");
  list.replaceChildren();

  if (!releases.length) {
    const empty = el("p", "empty");
    empty.append("No published releases yet. ");
    empty.append(link(RELEASES_PAGE, "text-link", "Check GitHub releases"));
    list.append(empty);
    return;
  }

  const latestTag = releases[0].tag_name;

  releases.slice(0, 6).forEach((release, index) => {
    const card = el("article", `release${index === 0 ? " latest" : ""}`);
    const aside = el("div", "release-aside");
    const tag = el("span", "release-tag");
    tag.append(icon("i-tag"), document.createTextNode(release.tag_name || "untagged"));
    aside.append(tag);

    const date = release.published_at || release.created_at;
    if (date) {
      const stamp = el("span", "release-date");
      stamp.append(icon("i-calendar"), document.createTextNode(formatDate(date)));
      aside.append(stamp);
    }
    if (index === 0) aside.append(el("span", "latest-label", "Latest"));

    const body = el("div", "release-body");
    body.append(el("h3", null, release.name || release.tag_name || "Release"));

    const rich = release.body_html ? sanitizeHTML(release.body_html) : "";
    if (rich) {
      const notes = el("div", "release-notes rich");
      notes.innerHTML = rich;
      if (rich.length > 900) notes.classList.add("clamped");
      body.append(notes);
    } else {
      const notes = (release.body || "").trim();
      if (notes) body.append(el("p", "release-notes", notes.slice(0, 500)));
    }

    if (Array.isArray(release.assets) && release.assets.length) {
      const assets = el("div", "release-assets");
      release.assets.slice(0, 6).forEach((asset) => {
        const chip = link(asset.browser_download_url, "chip");
        chip.append(icon("i-download"), el("span", null, asset.name));
        assets.append(chip);
      });
      if (release.assets.length > 6) {
        assets.append(
          link(release.html_url, "chip", `+${release.assets.length - 6} more`)
        );
      }
      body.append(assets);
    }

    const more = link(release.html_url, "release-more");
    more.append(document.createTextNode("Release notes on GitHub"), icon("i-arrow"));
    body.append(more);

    card.append(aside, body);
    list.append(card);
  });

  if (releases.length > 6) {
    const more = link(RELEASES_PAGE, "release-more");
    more.append(document.createTextNode(`View all ${releases.length} releases`), icon("i-arrow"));
    list.append(more);
  }
}

function wireControls() {
  const toggle = document.getElementById("menu-toggle");
  const nav = document.getElementById("nav");
  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });
  nav.addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      nav.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    }
  });

  const copy = document.getElementById("copy-source");
  copy.addEventListener("click", async () => {
    const command = copy.previousElementSibling.textContent.trim();
    try {
      await navigator.clipboard.writeText(command);
      copy.classList.add("copied");
      setTimeout(() => copy.classList.remove("copied"), 1500);
    } catch {
      const range = document.createRange();
      range.selectNodeContents(copy.previousElementSibling);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }
  });
}

async function init() {
  wireControls();
  const [latest, releases] = await Promise.all([
    fetchJSON(`${API}/releases/latest`),
    fetchJSON(`${API}/releases?per_page=10`),
  ]);

  setVersion(latest);
  renderPlatforms(latest);
  renderReleases(Array.isArray(releases) ? releases : latest ? [latest] : []);

  const sub = document.getElementById("downloads-sub");
  if (!latest || !latest.assets || latest.assets.length === 0) {
    sub.textContent =
      "No installers have been attached to the latest release yet. Until then, build from source — or watch the releases page for new files.";
  }
}

init();
