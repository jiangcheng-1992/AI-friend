const API_BASE =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:8787/api"
    : `${window.location.origin}/api`;

const appState = {
  currentTab: "home",
  homeFilter: "recommend",
  userId: "",
  likedPostIds: [],
  replyTarget: null,
  pendingDrawResults: [],
  currentPostId: null,
  ownedCharacters: [],
  stories: [],
  characters: {},
  feed: [],
  messages: [],
  drawRemaining: 0,
  profile: {
    postCount: 0,
    commentCount: 0,
    closeCount: 0,
  },
  modelReady: false,
};

const feedList = document.querySelector("#feed-list");
const messageList = document.querySelector("#message-list");
const storyStrip = document.querySelector("#story-strip");
const drawCount = document.querySelector("#draw-count");
const drawResultCards = document.querySelector("#draw-result-cards");
const detailPost = document.querySelector("#detail-post");
const detailComments = document.querySelector("#detail-comments");
const detailCommentCount = document.querySelector("#detail-comment-count");
const detailStatus = document.querySelector("#detail-status");
const characterHeader = document.querySelector("#character-header");
const characterPosts = document.querySelector("#character-posts");
const relationshipCard = document.querySelector("#relationship-card");
const toastEl = document.querySelector("#toast");
const ownedCount = document.querySelector("#owned-count");
const postInput = document.querySelector("#post-input");
const replyInput = document.querySelector("#reply-input");
const heroActiveCount = document.querySelector("#hero-active-count");
const heroInteractionCount = document.querySelector("#hero-interaction-count");
const heroDrawCount = document.querySelector("#hero-draw-count");
const profilePostCount = document.querySelector("#profile-post-count");
const profileCommentCount = document.querySelector("#profile-comment-count");
const profileCloseCount = document.querySelector("#profile-close-count");
const publishBtn = document.querySelector("#publish-btn");
const replyBtn = document.querySelector("#reply-btn");
const replyTargetEl = document.querySelector("#reply-target");
const rosterGrid = document.querySelector("#roster-grid");
const rosterSummaryText = document.querySelector("#roster-summary-text");
let toastTimer = null;
let postPollTimer = null;

function ensureUserId() {
  const key = "ai-moments-user-id";
  let value = localStorage.getItem(key);
  if (!value) {
    value = `user_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    localStorage.setItem(key, value);
  }
  appState.userId = value;
}

function getLikedPostsStorageKey() {
  return `ai-moments-liked-posts:${appState.userId || "guest"}`;
}

function loadLikedPosts() {
  try {
    const raw = localStorage.getItem(getLikedPostsStorageKey());
    appState.likedPostIds = raw ? JSON.parse(raw) : [];
  } catch {
    appState.likedPostIds = [];
  }
}

function saveLikedPosts() {
  localStorage.setItem(getLikedPostsStorageKey(), JSON.stringify(appState.likedPostIds));
}

function isPostLiked(postId) {
  return appState.likedPostIds.includes(postId);
}

function parseLikeCount(value) {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return 0;
  if (text.endsWith("k")) {
    return Math.round(Number(text.slice(0, -1)) * 1000);
  }
  return Number(text) || 0;
}

function formatLikeCount(value) {
  const count = Math.max(0, Number(value) || 0);
  if (count >= 1000) {
    const display = (count / 1000).toFixed(count >= 10000 ? 0 : 1).replace(/\.0$/, "");
    return `${display}k`;
  }
  return String(count);
}

async function apiFetch(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "璇锋眰澶辫触");
  }
  return data;
}

function getAvatarClass(name) {
  if (name === "鎴?) return "avatar-user";
  const classMap = {
    瀛斿瓙: "avatar-confucius",
    鏉庣櫧: "avatar-libai",
    璨傝潐: "avatar-diaochan",
    鍗庝綏: "avatar-huatuo",
    姝﹀垯澶? "avatar-wuzetian",
    鏉庢竻鐓? "avatar-liqingzhao",
    鐙勪粊鏉? "avatar-direnjie",
    鑻忚郊: "avatar-sushi",
  };
  return classMap[name] || "";
}

function getCharacterMeta(name) {
  if (name === "鎴?) {
    return {
      avatarUrl: "./assets/avatars/user.svg",
      title: "姝ゅ埢鐨勪綘",
      tags: ["鐪熷疄", "鏃ュ父"],
    };
  }
  return appState.characters[name] || {};
}

function getAvatarSrc(name, explicitUrl = "") {
  if (explicitUrl) return explicitUrl;
  const meta = getCharacterMeta(name);
  if (meta.avatarUrl) return meta.avatarUrl;
  const assetMap = {
    鎴? "./assets/avatars/user.svg",
    瀛斿瓙: "./assets/avatars/confucius.svg",
    鏉庣櫧: "./assets/avatars/libai.svg",
    璨傝潐: "./assets/avatars/diaochan.svg",
    鍗庝綏: "./assets/avatars/huatuo.svg",
    姝﹀垯澶? "./assets/avatars/wuzetian.svg",
    鏉庢竻鐓? "./assets/avatars/liqingzhao.svg",
    鐙勪粊鏉? "./assets/avatars/direnjie.svg",
    鑻忚郊: "./assets/avatars/sushi.svg",
  };
  return assetMap[name] || "./assets/avatars/user.svg";
}

function getAvatarMarkup(entity, sizeClass = "", isButton = false, action = "", character = "") {
  const meta = typeof entity === "string" ? { name: entity } : entity || {};
  const name = meta.name || meta.author || "鎴?;
  const tag = isButton ? "button" : "div";
  const actionAttr = action ? ` data-action="${action}"` : "";
  const characterAttr = character ? ` data-character="${character}"` : "";
  const avatarClass = `${getAvatarClass(name)} ${sizeClass}`.trim();
  return `
    <${tag} class="avatar ${avatarClass}"${actionAttr}${characterAttr}>
      <img src="${getAvatarSrc(name, meta.avatarUrl)}" alt="${name}" loading="eager" />
    </${tag}>
  `;
}

function getPostImageSrc(post) {
  if (post.imageUrl) return post.imageUrl;
  const imageMap = {
    璨傝潐: "./assets/posts/diaochan-feed.svg",
    瀛斿瓙: "./assets/posts/confucius-feed.svg",
    鏉庣櫧: "./assets/posts/libai-feed.svg",
    鎴? "./assets/posts/generic-user.svg",
  };
  return imageMap[post.author] || "./assets/posts/generic-user.svg";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderRichText(value) {
  return escapeHtml(value).replace(/\n/g, "<br />");
}

function setButtonBusy(button, busy, busyText, idleText) {
  if (!button) return;
  button.disabled = busy;
  button.textContent = busy ? busyText : idleText;
}

function getPostBadge(post) {
  if (post.author === "鎴?) return "鎴戠殑鍔ㄦ€?;
  if (post.author === "璨傝潐") return "鐑棬鎺ㄨ崘";
  if (post.author === "瀛斿瓙") return "浠婃棩鎬濊€?;
  if (post.author === "鏉庣櫧") return "娣卞鐏垫劅";
  return "AI鍦ㄥ彂澹?;
}

function applyBootstrap(data) {
  appState.drawRemaining = data.draw?.remaining ?? 0;
  appState.ownedCharacters = data.ownedCharacters || [];
  appState.stories = data.stories || [];
  appState.characters = data.characters || {};
  appState.feed = data.feed || [];
  appState.messages = data.messages || [];
  appState.profile = data.profile || appState.profile;
  appState.modelReady = Boolean(data.modelReady);

  updateDrawCount();
  updateOwnedCount();
  updateStats();
  renderStories();
  renderFeed();
  renderMessages();
}

async function loadBootstrap() {
  const data = await apiFetch(`/bootstrap?userId=${encodeURIComponent(appState.userId)}`);
  applyBootstrap(data);
}

function renderStories() {
  storyStrip.innerHTML = appState.stories
    .map((item, index) => {
      const name = item.name;
      const character = appState.characters[name] || { tags: [item.tag], title: "" };
      return `
        <button class="story-item" data-action="open-character" data-character="${name}">
          <span class="story-ring">
            ${getAvatarMarkup(name, "lg")}
          </span>
          <strong>${name}</strong>
          <span>${item.tag || (index < 3 ? "鍒氬垰鍙戞柊鍔ㄦ€? : character.tags[0])}</span>
        </button>
      `;
    })
    .join("");
}

function getFilteredFeed() {
  switch (appState.homeFilter) {
    case "my-roles":
      return appState.feed.filter((post) => post.author !== "鎴?);
    case "high-engagement":
      return [...appState.feed].sort((a, b) => (b.comments?.length || 0) - (a.comments?.length || 0));
    case "story":
      return appState.feed.filter((post) => post.comments?.length === 0 || /鍒氬垰|鍒嗛挓鍓?.test(post.time));
    case "recommend":
    default:
      return appState.feed;
  }
}

function renderFeed() {
  const visibleFeed = getFilteredFeed();
  if (!visibleFeed.length) {
    feedList.innerHTML = `
      <article class="card empty-state">
        <span class="eyebrow accent">鏆傛椂绌虹┖</span>
        <h3>杩欎竴鏍忚繕娌℃湁鍐呭</h3>
        <p>鎹釜绛涢€夌湅鐪嬶紝鎴栬€呭厛鍘诲彂涓€鏉″姩鎬侊紝AI 瑙掕壊寰堝揩灏变細鍥磋繃鏉ャ€?/p>
      </article>
    `;
    return;
  }

  feedList.innerHTML = visibleFeed
    .map((post) => {
      const previewComments = post.comments.slice(0, 2);
      const isUser = post.author === "鎴?;
      const liked = isPostLiked(post.id);
      return `
        <article class="post-card card" data-post-id="${post.id}">
          <div class="post-badge-row">
            <span class="post-badge">${getPostBadge(post)}</span>
            <span class="post-badge subtle">${post.comments.length > 1 ? "浜掑姩鍗囨俯涓? : "鎺ㄨ崘缁欎綘"}</span>
          </div>
          <div class="post-head">
            <div class="post-author">
              ${getAvatarMarkup({ name: post.author, avatarUrl: post.authorAvatarUrl }, "", !isUser, isUser ? "" : "open-character", isUser ? "" : post.author)}
              <div class="post-info">
                <strong>${post.author}</strong>
                <span class="post-tags">${post.title}</span>
                <span class="post-time">${post.time}</span>
              </div>
            </div>
            <button class="text-btn" data-action="open-detail" data-post-id="${post.id}">璇︽儏</button>
          </div>
          <div class="post-content">${renderRichText(post.content)}</div>
          ${post.image ? `<div class="post-image"><img src="${getPostImageSrc(post)}" alt="${post.author}鍔ㄦ€侀厤鍥? loading="eager" /></div>` : ""}
          <div class="post-footer">
            <button class="footer-action-btn ${liked ? "active" : ""}" data-action="toggle-like" data-post-id="${post.id}">
              <span class="footer-icon">${liked ? "鈾? : "鈾?}</span>
              <span>鐐硅禐 ${post.likes}</span>
            </button>
            <button class="footer-action-btn" data-action="open-detail" data-post-id="${post.id}">
              <span class="footer-icon">鈼?/span>
              <span>璇勮 ${post.comments.length}</span>
            </button>
          </div>
          ${
            previewComments.length
              ? `<div class="post-preview-stack">
                  ${previewComments
                    .map(
                      (comment, index) => `
                        <div class="post-preview-comment">
                          <span class="comment-chip">${index === 0 ? "鐑瘎" : "鏂拌瘎"}</span>
                          <strong>${comment.author}锛?/strong>${escapeHtml(comment.content)}
                        </div>
                      `
                    )
                    .join("")}
                </div>`
              : ""
          }
        </article>
      `;
    })
    .join("");
}

function renderMessages() {
  messageList.innerHTML = appState.messages
    .map(
      (item, index) => `
        <button class="message-item" data-action="${index < 2 ? "open-latest-user-post" : "go-draw"}">
          ${getAvatarMarkup(index === 0 ? "璨傝潐" : index === 1 ? "瀛斿瓙" : "鎴?)}
          <div>
            <strong>${item.title}</strong>
            <p>${escapeHtml(item.content)}</p>
            <span class="post-time">${item.time}</span>
          </div>
        </button>
      `
    )
    .join("");
}

function updateDrawCount() {
  drawCount.textContent = `${appState.drawRemaining} / 3`;
  heroDrawCount.textContent = appState.drawRemaining;
}

function updateOwnedCount() {
  ownedCount.textContent = appState.ownedCharacters.length;
  heroActiveCount.textContent = appState.ownedCharacters.length;
}

function updateStats() {
  const interactionCount = appState.feed.reduce((sum, post) => sum + (post.comments?.length || 0), 0);
  heroInteractionCount.textContent = interactionCount;
  profilePostCount.textContent = appState.profile.postCount ?? 0;
  profileCommentCount.textContent = appState.profile.commentCount ?? 0;
  profileCloseCount.textContent = appState.profile.closeCount ?? 0;
}

function setHomeFilter(filter) {
  appState.homeFilter = filter;
  document.querySelectorAll(".filter-chip").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.filter === filter);
  });
  renderFeed();
}

function switchTab(tab) {
  appState.currentTab = tab;
  document.querySelectorAll(".screen").forEach((screen) => screen.classList.remove("active"));
  document.querySelector(`#screen-${tab}`)?.classList.add("active");

  document.querySelectorAll(".tab-item").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });
}

function openOverlay(id) {
  document.querySelector(id).classList.remove("hidden");
}

function closeOverlay(id) {
  document.querySelector(id).classList.add("hidden");
}

function showToast(message) {
  toastEl.textContent = message;
  toastEl.className = "toast";
  if (toastTimer) {
    clearTimeout(toastTimer);
  }
  toastTimer = setTimeout(() => {
    toastEl.className = "toast hidden";
    toastTimer = null;
  }, 1800);
}

function clearReplyTarget() {
  appState.replyTarget = null;
  replyTargetEl.classList.add("hidden");
  replyTargetEl.innerHTML = "";
  replyInput.placeholder = "鍥炲涓€鍙?..";
}

function setReplyTarget(comment) {
  if (!comment || comment.author === "鎴?) return;
  appState.replyTarget = {
    commentId: comment.id,
    characterName: comment.author,
    content: comment.content,
  };
  replyTargetEl.classList.remove("hidden");
  replyTargetEl.innerHTML = `
    <span>姝ｅ湪鍥炲 <strong>${comment.author}</strong>锛?{escapeHtml(comment.content).slice(0, 20)}${comment.content.length > 20 ? "..." : ""}</span>
    <button type="button" data-action="clear-reply-target">鍙栨秷</button>
  `;
  replyInput.placeholder = `鍥炲 ${comment.author}...`;
  replyInput.focus();
}

function renderRoster() {
  const ownedCharacters = appState.ownedCharacters
    .map((name) => ({
      name,
      ...(appState.characters[name] || {}),
    }))
    .filter((item) => item.name);

  rosterSummaryText.textContent = `褰撳墠鍏辨湁 ${ownedCharacters.length} 浣嶈鑹插父椹伙紝浠栦滑浼氭牴鎹綘鐨勫唴瀹逛富棰樻潵鍑虹幇浜掑姩銆俙;

  rosterGrid.innerHTML = ownedCharacters
    .map(
      (character) => `
        <button class="roster-card" data-action="open-character" data-character="${character.name}">
          <div class="roster-card-head">
            ${getAvatarMarkup({ name: character.name, avatarUrl: character.avatarUrl }, "lg")}
            <div>
              <strong>${character.name}</strong>
              <p>${character.title || ""}</p>
            </div>
          </div>
          <div class="roster-tags">
            ${(character.tags || []).slice(0, 3).map((tag) => `<span class="stat-pill">${tag}</span>`).join("")}
          </div>
        </button>
      `
    )
    .join("");
}

function openRoster() {
  renderRoster();
  openOverlay("#roster-overlay");
}

function stopPostPolling() {
  if (postPollTimer) {
    clearInterval(postPollTimer);
    postPollTimer = null;
  }
}

function pollPostUpdates(postId, initialCommentCount = 0) {
  stopPostPolling();
  let attempts = 0;
  postPollTimer = setInterval(async () => {
    attempts += 1;
    try {
      const result = await apiFetch(`/posts/${encodeURIComponent(postId)}`);
      const latestPost = result.post;
      upsertPost(latestPost);
      if (appState.currentPostId === postId) {
        await openDetail(postId);
      }
      const latestCommentCount = latestPost.comments?.length || 0;
      if (latestCommentCount > initialCommentCount) {
        stopPostPolling();
        showToast("AI 瑙掕壊宸茬粡寮€濮嬩簰鍔ㄤ簡");
        return;
      }
    } catch (error) {
      console.error("pollPostUpdates failed:", error);
    }

    if (attempts >= 8) {
      stopPostPolling();
    }
  }, 1200);
}

function findPost(postId) {
  return appState.feed.find((post) => post.id === postId);
}

function upsertPost(post) {
  const index = appState.feed.findIndex((item) => item.id === post.id);
  if (index >= 0) {
    appState.feed[index] = post;
  } else {
    appState.feed.unshift(post);
  }
  renderFeed();
  updateStats();
}

function toggleLike(postId) {
  const post = findPost(postId);
  if (!post) return;

  const liked = isPostLiked(postId);
  const nextLikeCount = parseLikeCount(post.likes) + (liked ? -1 : 1);
  post.likes = formatLikeCount(nextLikeCount);

  if (liked) {
    appState.likedPostIds = appState.likedPostIds.filter((id) => id !== postId);
    showToast("宸插彇娑堢偣璧?);
  } else {
    appState.likedPostIds = [...appState.likedPostIds, postId];
    showToast("宸茬偣璧?);
  }

  saveLikedPosts();
  renderFeed();

  if (appState.currentPostId === postId) {
    openDetail(postId);
  }
}

async function openDetail(postId) {
  let post = findPost(postId);
  if (!post) {
    const result = await apiFetch(`/posts/${encodeURIComponent(postId)}`);
    post = result.post;
    upsertPost(post);
  }
  if (!post) return;

  appState.currentPostId = postId;
  clearReplyTarget();
  const aiCommentsCount = post.comments.filter((comment) => comment.author !== "鎴?).length;
  const liked = isPostLiked(post.id);
  detailPost.innerHTML = `
    <div class="post-head">
      <div class="post-author">
        ${getAvatarMarkup({ name: post.author, avatarUrl: post.authorAvatarUrl })}
        <div class="post-info">
          <strong>${post.author}</strong>
          <span class="post-tags">${post.title}</span>
          <span class="post-time">${post.time}</span>
        </div>
      </div>
    </div>
    <div class="post-content">${renderRichText(post.content)}</div>
    ${post.image ? `<div class="post-image"><img src="${getPostImageSrc(post)}" alt="${post.author}鍔ㄦ€侀厤鍥? loading="eager" /></div>` : ""}
    <div class="post-footer">
      <button class="footer-action-btn ${liked ? "active" : ""}" data-action="toggle-like" data-post-id="${post.id}">
        <span class="footer-icon">${liked ? "鈾? : "鈾?}</span>
        <span>鐐硅禐 ${post.likes}</span>
      </button>
      <button class="footer-action-btn active" data-action="focus-reply">
        <span class="footer-icon">鈼?/span>
        <span>璇勮 ${post.comments.length}</span>
      </button>
    </div>
  `;

  detailStatus.innerHTML = `
    <span class="eyebrow accent">浜掑姩鐘舵€?/span>
    <h3>${aiCommentsCount > 0 ? `宸叉湁 ${aiCommentsCount} 浣嶈鑹插弬涓庝簰鍔╜ : "鏈嬪弸鍦堝眳姘戞鍦ㄥ洿瑙備腑"}</h3>
    <p>${aiCommentsCount > 0 ? "浣犲彲浠ョ户缁洖澶嶈瘎璁猴紝璁╄鑹蹭箣闂寸殑浜掑姩缁х画鍗囨俯銆? : "绯荤粺浼氫紭鍏堜负浣犲尮閰嶆渶閫傚悎璇勮杩欐潯鍔ㄦ€佺殑瑙掕壊銆?} </p>
  `;

  detailCommentCount.textContent = `${post.comments.length}鏉;
  detailComments.innerHTML = post.comments
    .map(
      (comment) => `
        <div class="comment-item">
          ${getAvatarMarkup({ name: comment.author, avatarUrl: comment.avatarUrl }, "", comment.author !== "鎴?, comment.author === "鎴? ? "" : "open-character", comment.author === "鎴? ? "" : comment.author)}
          <div class="comment-body">
            <strong>${comment.author}</strong>
            <p>${renderRichText(comment.content)}</p>
            <div class="comment-meta">
              <span>${comment.time || "鍒氬垰"}</span>
              ${comment.author !== "鎴? ? `<button class="comment-reply-btn" data-action="reply-to-comment" data-comment-id="${comment.id}">鍥炲TA</button>` : ""}
            </div>
          </div>
        </div>
      `
    )
    .join("");

  openOverlay("#post-detail-overlay");
}

async function openCharacter(name) {
  const character =
    appState.characters[name] ||
    (await apiFetch(`/characters/${encodeURIComponent(name)}?userId=${encodeURIComponent(appState.userId)}`));
  if (!character) return;
  const owned = appState.ownedCharacters.includes(name);
  const moodLineMap = {
    瀛斿瓙: "甯稿湪浣犲彂鎯呯华鍜屼汉鐢熸劅鎮熺被鍔ㄦ€佹椂浼樺厛鍑虹幇",
    鏉庣櫧: "澶滄櫄鏇存椿璺冿紝閫傚悎鍦ㄤ綘娣卞鍙戝笘鏃舵潵璇勮浣?,
    璨傝潐: "瀵圭編濡嗐€佹儏缁拰绀句氦绫诲唴瀹瑰搷搴旀渶绉瀬",
    鍗庝綏: "鍦ㄤ綘鐔銆佺柌鎯垨鍋ュ悍鐩稿叧鍔ㄦ€佷笅缁忓父鍑虹幇",
    姝﹀垯澶? "鎿呴暱缁欎綘鎴愰暱銆佸垽鏂笌鎺屾帶鎰熸柟鍚戠殑鍥炲簲",
    鏉庢竻鐓? "鍦ㄤ綆钀姐€佹兂蹇典笌缁嗚吇鎯呯华璇濋涓渶鏈夊叡楦?,
    鐙勪粊鏉? "浼氬湪澶嶆潅闂鍜屽叧绯昏浼氶噷缁欏嚭娓呮櫚鎷嗚В",
    鑻忚郊: "閫傚悎鐢熸椿鎰熴€佹不鎰堟劅銆佹兂琚畨鎱扮殑鏃跺€欏嚭鐜?,
  };

  characterHeader.innerHTML = `
    <div class="character-summary">
      ${getAvatarMarkup(name, "lg")}
      <div>
        <h3>${name}</h3>
        <p>${character.title}</p>
      </div>
    </div>
    <div class="stat-row">
      ${character.tags.map((tag) => `<span class="stat-pill">${tag}</span>`).join("")}
      <span class="stat-pill">浜插瘑搴?${character.intimacy}</span>
    </div>
    <p>${character.intro || ""}</p>
    <div class="character-actions">
      <button class="primary-btn small wide">${owned ? "宸插湪鎴戠殑鏈嬪弸鍦? : "鍔犲叆鎴戠殑鏈嬪弸鍦?}</button>
      <button class="secondary-btn small wide">璁剧疆涓虹壒鍒叧娉?/button>
    </div>
  `;

  relationshipCard.innerHTML = `
    <span class="eyebrow accent">浣犲拰 TA 鐨勫叧绯?/span>
    <h3>${owned ? "宸茬粡鏄綘鐨勫父椹绘湅鍙嬪湀灞呮皯" : "杩樻病鏈夊姞鍏ヤ綘鐨勮鑹查樀瀹?}</h3>
    <p>${moodLineMap[name] || "TA 浼氭牴鎹綘鍙戝笘鐨勫唴瀹逛富棰橈紝閫夋嫨閫傚悎鐨勬椂鍊欏嚭鐜板苟璇勮浣犮€?}</p>
    <div class="relationship-metrics">
      <div>
        <strong>${character.intimacy}</strong>
        <span>褰撳墠浜插瘑搴?/span>
      </div>
      <div>
        <strong>${owned ? "楂? : "涓?}</strong>
        <span>鍑哄満鎰忔効</span>
      </div>
      <div>
        <strong>${character.tags[0]}</strong>
        <span>鏈€鎿呴暱璇濋</span>
      </div>
    </div>
  `;

  characterPosts.innerHTML = character.posts.map((post) => `<div class="micro-post">${post}</div>`).join("");
  openOverlay("#character-overlay");
}

function renderDrawResults(results) {
  drawResultCards.innerHTML = results
    .map(
      (item) => `
        <div class="result-card">
          <div class="result-top">
            <div class="result-title">
              ${getAvatarMarkup(item.name)}
              <strong>${item.name}</strong>
            </div>
            <span class="rarity ${item.rarity.toLowerCase()}">${item.rarity}</span>
          </div>
          <p>${item.line}</p>
        </div>
      `
    )
    .join("");
}

async function doDraw(count) {
  if (appState.drawRemaining <= 0) {
    showToast("浠婂ぉ鐨勫厤璐规鏁板凡缁忕敤瀹屼簡");
    return;
  }
  const result = await apiFetch("/draw", {
    method: "POST",
    body: JSON.stringify({
      userId: appState.userId,
      count,
    }),
  });
  appState.pendingDrawResults = result.results || [];
  await loadBootstrap();
  renderDrawResults(appState.pendingDrawResults);
  openOverlay("#draw-result-overlay");
}

function joinCharactersToFriends() {
  closeOverlay("#draw-result-overlay");
  switchTab("home");
  showToast("鏂拌鑹插凡鍏ラ┗浣犵殑鏈嬪弸鍦?);
}

async function createUserPost(content) {
  const trimmed = content.trim();
  if (!trimmed) {
    showToast("鍏堝啓鐐瑰唴瀹瑰啀鍙戝竷鍚?);
    return;
  }
  setButtonBusy(publishBtn, true, "鍙戝竷涓?..", "鍙戝竷");
  try {
    const result = await apiFetch("/posts", {
      method: "POST",
      body: JSON.stringify({
        userId: appState.userId,
        content: trimmed,
      }),
    });
    await loadBootstrap();
    closeOverlay("#compose-overlay");
    postInput.value = "";
    await openDetail(result.post.id);
    if (result.aiCommentCount > 0) {
      showToast(`宸插彂甯冿紝${result.aiCommentCount} 浣嶈鑹插凡鏉ヤ簰鍔╜);
    } else if (result.aiCommentError) {
      showToast("宸插彂甯冩垚鍔燂紝AI 浜掑姩绋嶅悗琛ヤ笂");
    } else if (appState.modelReady) {
      showToast("宸插彂甯冿紝AI 瑙掕壊姝ｅ湪璧舵潵璇勮");
      pollPostUpdates(result.post.id, result.post.comments?.length || 0);
    } else {
      showToast("宸插彂甯冿紝閰嶇疆妯″瀷鍚庡皢鐢熸垚鐪熷疄 AI 浜掑姩");
    }
  } finally {
    setButtonBusy(publishBtn, false, "鍙戝竷涓?..", "鍙戝竷");
  }
}

function openLatestUserPost() {
  const latestUserPost = appState.feed.find((post) => post.author === "鎴?);
  if (!latestUserPost) {
    showToast("浣犺繕娌℃湁鍙戝竷鍔ㄦ€侊紝鍏堝幓鍙戜竴鏉″惂");
    switchTab("home");
    return;
  }
  openDetail(latestUserPost.id);
}

async function handleReply() {
  const text = replyInput.value.trim();
  if (!appState.currentPostId) {
    showToast("鍏堟墦寮€涓€鏉″姩鎬佸啀璇勮");
    return;
  }
  if (!text) {
    showToast("杈撳叆鐐瑰唴瀹瑰啀鍙戦€?);
    return;
  }
  setButtonBusy(replyBtn, true, "鍙戦€佷腑...", "鍙戦€?);
  try {
    const targetedName = appState.replyTarget?.characterName || "";
    const result = await apiFetch(`/posts/${encodeURIComponent(appState.currentPostId)}/reply`, {
      method: "POST",
      body: JSON.stringify({
        userId: appState.userId,
        content: text,
        targetCommentId: appState.replyTarget?.commentId || "",
        targetCharacterName: appState.replyTarget?.characterName || "",
      }),
    });
    replyInput.value = "";
    clearReplyTarget();
    await loadBootstrap();
    await openDetail(result.post.id);
    if (result.aiReplyGenerated) {
      if (targetedName) {
        showToast(
          result.aiReplyCount > 1 ? `${targetedName} 鍏堟帴璇濅簡锛屽彟澶?${result.aiReplyCount - 1} 浣嶄篃璺熶笂浜哷 : `${targetedName} 宸茬粡鍏堝洖澶嶄綘浜哷
        );
      } else {
        showToast(result.aiReplyCount > 1 ? `${result.aiReplyCount} 浣嶈鑹插凡缁忔帴璇漙 : "璇勮宸插彂閫侊紝瑙掕壊椹笂鎺ヨ瘽浜?);
      }
    } else if (result.aiReplyError) {
      showToast("璇勮宸插彂閫侊紝AI 鍥炲绋嶅悗琛ヤ笂");
      pollPostUpdates(result.post.id, result.post.comments?.length || 0);
    } else {
      showToast("璇勮宸插彂閫?);
      pollPostUpdates(result.post.id, result.post.comments?.length || 0);
    }
  } finally {
    setButtonBusy(replyBtn, false, "鍙戦€佷腑...", "鍙戦€?);
  }
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;

  const action = target.dataset.action;
  if (!action && target.dataset.tab) {
    switchTab(target.dataset.tab);
    return;
  }

  if (target.dataset.tabTarget) {
    switchTab(target.dataset.tabTarget);
    return;
  }

  switch (action) {
    case "open-compose":
      openOverlay("#compose-overlay");
      break;
    case "close-compose":
      closeOverlay("#compose-overlay");
      break;
    case "open-detail":
      openDetail(target.dataset.postId);
      break;
    case "close-detail":
      closeOverlay("#post-detail-overlay");
      break;
    case "open-character":
      openCharacter(target.dataset.character);
      break;
    case "close-character":
      closeOverlay("#character-overlay");
      break;
    case "back-home":
      switchTab("home");
      break;
    case "scroll-top":
      document.querySelector(".screen.active")?.scrollTo({ top: 0, behavior: "smooth" });
      break;
    case "show-toast":
      showToast(target.dataset.message || "鍔熻兘宸查鐣?);
      break;
    case "set-filter":
      setHomeFilter(target.dataset.filter || "recommend");
      break;
    case "toggle-like":
      toggleLike(target.dataset.postId);
      break;
    case "focus-reply":
      replyInput.focus();
      break;
    case "reply-to-comment": {
      const post = findPost(appState.currentPostId);
      const comment = post?.comments?.find((item) => item.id === target.dataset.commentId);
      if (comment) {
        setReplyTarget(comment);
      }
      break;
    }
    case "clear-reply-target":
      clearReplyTarget();
      break;
    case "open-latest-user-post":
      openLatestUserPost();
      break;
    case "go-draw":
      switchTab("draw");
      break;
    case "close-draw-result":
      closeOverlay("#draw-result-overlay");
      break;
    case "open-roster":
      openRoster();
      break;
    case "close-roster":
      closeOverlay("#roster-overlay");
      break;
    case "open-my-posts":
      openLatestUserPost();
      break;
    case "open-drafts":
      openOverlay("#drafts-overlay");
      break;
    case "close-drafts":
      closeOverlay("#drafts-overlay");
      break;
    case "open-settings":
      openOverlay("#settings-overlay");
      break;
    case "close-settings":
      closeOverlay("#settings-overlay");
      break;
    default:
      break;
  }
});

document.querySelector("#single-draw-btn").addEventListener("click", async () => {
  try {
    await doDraw(1);
  } catch (error) {
    showToast(error.message);
  }
});
document.querySelector("#triple-draw-btn").addEventListener("click", async () => {
  try {
    await doDraw(3);
  } catch (error) {
    showToast(error.message);
  }
});
document.querySelector("#join-friends-btn").addEventListener("click", joinCharactersToFriends);
document.querySelector("#publish-btn").addEventListener("click", async () => {
  try {
    await createUserPost(postInput.value);
  } catch (error) {
    showToast(error.message);
  }
});
document.querySelector("#reply-btn").addEventListener("click", async () => {
  try {
    await handleReply();
  } catch (error) {
    showToast(error.message);
  }
});

replyInput.addEventListener("keydown", async (event) => {
  if (event.key !== "Enter" || event.shiftKey) return;
  event.preventDefault();
  try {
    await handleReply();
  } catch (error) {
    showToast(error.message);
  }
});

async function initApp() {
  try {
    ensureUserId();
    loadLikedPosts();
    await loadBootstrap();
    if (!appState.modelReady) {
      showToast("鏈娴嬪埌璞嗗寘閰嶇疆锛岃鍏堝～鍐?.env 鍚庡惎鍔ㄥ悗绔?);
    }
    switchTab("home");
  } catch (error) {
    console.error(error);
    showToast(`鍒濆鍖栧け璐? ${error.message}`);
  }
}

initApp();
