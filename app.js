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
    throw new Error(data.error || "请求失败");
  }
  return data;
}

function getAvatarClass(name) {
  if (name === "我") return "avatar-user";
  const classMap = {
    孔子: "avatar-confucius",
    李白: "avatar-libai",
    貂蝉: "avatar-diaochan",
    华佗: "avatar-huatuo",
    武则天: "avatar-wuzetian",
    李清照: "avatar-liqingzhao",
    狄仁杰: "avatar-direnjie",
    苏轼: "avatar-sushi",
  };
  return classMap[name] || "";
}

function getCharacterMeta(name) {
  if (name === "我") {
    return {
      avatarUrl: "./assets/avatars/user.svg",
      title: "此刻的你",
      tags: ["真实", "日常"],
    };
  }
  return appState.characters[name] || {};
}

function getAvatarSrc(name, explicitUrl = "") {
  if (explicitUrl) return explicitUrl;
  const meta = getCharacterMeta(name);
  if (meta.avatarUrl) return meta.avatarUrl;
  const assetMap = {
    我: "./assets/avatars/user.svg",
    孔子: "./assets/avatars/confucius.svg",
    李白: "./assets/avatars/libai.svg",
    貂蝉: "./assets/avatars/diaochan.svg",
    华佗: "./assets/avatars/huatuo.svg",
    武则天: "./assets/avatars/wuzetian.svg",
    李清照: "./assets/avatars/liqingzhao.svg",
    狄仁杰: "./assets/avatars/direnjie.svg",
    苏轼: "./assets/avatars/sushi.svg",
  };
  return assetMap[name] || "./assets/avatars/user.svg";
}

function getAvatarMarkup(entity, sizeClass = "", isButton = false, action = "", character = "") {
  const meta = typeof entity === "string" ? { name: entity } : entity || {};
  const name = meta.name || meta.author || "我";
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
    貂蝉: "./assets/posts/diaochan-feed.svg",
    孔子: "./assets/posts/confucius-feed.svg",
    李白: "./assets/posts/libai-feed.svg",
    我: "./assets/posts/generic-user.svg",
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
  if (post.author === "我") return "我的动态";
  if (post.author === "貂蝉") return "热门推荐";
  if (post.author === "孔子") return "今日思考";
  if (post.author === "李白") return "深夜灵感";
  return "AI在发声";
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
          <span>${item.tag || (index < 3 ? "刚刚发新动态" : character.tags[0])}</span>
        </button>
      `;
    })
    .join("");
}

function getFilteredFeed() {
  switch (appState.homeFilter) {
    case "my-roles":
      return appState.feed.filter((post) => post.author !== "我");
    case "high-engagement":
      return [...appState.feed].sort((a, b) => (b.comments?.length || 0) - (a.comments?.length || 0));
    case "story":
      return appState.feed.filter((post) => post.comments?.length === 0 || /刚刚|分钟前/.test(post.time));
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
        <span class="eyebrow accent">暂时空空</span>
        <h3>这一栏还没有内容</h3>
        <p>换个筛选看看，或者先去发一条动态，AI 角色很快就会围过来。</p>
      </article>
    `;
    return;
  }

  feedList.innerHTML = visibleFeed
    .map((post) => {
      const previewComments = post.comments.slice(0, 2);
      const isUser = post.author === "我";
      const liked = isPostLiked(post.id);
      return `
        <article class="post-card card" data-post-id="${post.id}">
          <div class="post-badge-row">
            <span class="post-badge">${getPostBadge(post)}</span>
            <span class="post-badge subtle">${post.comments.length > 1 ? "互动升温中" : "推荐给你"}</span>
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
            <button class="text-btn" data-action="open-detail" data-post-id="${post.id}">详情</button>
          </div>
          <div class="post-content">${renderRichText(post.content)}</div>
          ${post.image ? `<div class="post-image"><img src="${getPostImageSrc(post)}" alt="${post.author}动态配图" loading="eager" /></div>` : ""}
          <div class="post-footer">
            <button class="footer-action-btn ${liked ? "active" : ""}" data-action="toggle-like" data-post-id="${post.id}">
              <span class="footer-icon">${liked ? "♥" : "♡"}</span>
              <span>点赞 ${post.likes}</span>
            </button>
            <button class="footer-action-btn" data-action="open-detail" data-post-id="${post.id}">
              <span class="footer-icon">◦</span>
              <span>评论 ${post.comments.length}</span>
            </button>
          </div>
          ${
            previewComments.length
              ? `<div class="post-preview-stack">
                  ${previewComments
                    .map(
                      (comment, index) => `
                        <div class="post-preview-comment">
                          <span class="comment-chip">${index === 0 ? "热评" : "新评"}</span>
                          <strong>${comment.author}：</strong>${escapeHtml(comment.content)}
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
          ${getAvatarMarkup(index === 0 ? "貂蝉" : index === 1 ? "孔子" : "我")}
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
  replyInput.placeholder = "回复一句...";
}

function setReplyTarget(comment) {
  if (!comment || comment.author === "我") return;
  appState.replyTarget = {
    commentId: comment.id,
    characterName: comment.author,
    content: comment.content,
  };
  replyTargetEl.classList.remove("hidden");
  replyTargetEl.innerHTML = `
    <span>正在回复 <strong>${comment.author}</strong>：${escapeHtml(comment.content).slice(0, 20)}${comment.content.length > 20 ? "..." : ""}</span>
    <button type="button" data-action="clear-reply-target">取消</button>
  `;
  replyInput.placeholder = `回复 ${comment.author}...`;
  replyInput.focus();
}

function renderRoster() {
  const ownedCharacters = appState.ownedCharacters
    .map((name) => ({
      name,
      ...(appState.characters[name] || {}),
    }))
    .filter((item) => item.name);

  rosterSummaryText.textContent = `当前共有 ${ownedCharacters.length} 位角色常驻，他们会根据你的内容主题来出现互动。`;

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
        showToast("AI 角色已经开始互动了");
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
    showToast("已取消点赞");
  } else {
    appState.likedPostIds = [...appState.likedPostIds, postId];
    showToast("已点赞");
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
  const aiCommentsCount = post.comments.filter((comment) => comment.author !== "我").length;
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
    ${post.image ? `<div class="post-image"><img src="${getPostImageSrc(post)}" alt="${post.author}动态配图" loading="eager" /></div>` : ""}
    <div class="post-footer">
      <button class="footer-action-btn ${liked ? "active" : ""}" data-action="toggle-like" data-post-id="${post.id}">
        <span class="footer-icon">${liked ? "♥" : "♡"}</span>
        <span>点赞 ${post.likes}</span>
      </button>
      <button class="footer-action-btn active" data-action="focus-reply">
        <span class="footer-icon">◦</span>
        <span>评论 ${post.comments.length}</span>
      </button>
    </div>
  `;

  detailStatus.innerHTML = `
    <span class="eyebrow accent">互动状态</span>
    <h3>${aiCommentsCount > 0 ? `已有 ${aiCommentsCount} 位角色参与互动` : "朋友圈居民正在围观中"}</h3>
    <p>${aiCommentsCount > 0 ? "你可以继续回复评论，让角色之间的互动继续升温。" : "系统会优先为你匹配最适合评论这条动态的角色。"} </p>
  `;

  detailCommentCount.textContent = `${post.comments.length}条`;
  detailComments.innerHTML = post.comments
    .map(
      (comment) => `
        <div class="comment-item">
          ${getAvatarMarkup({ name: comment.author, avatarUrl: comment.avatarUrl }, "", comment.author !== "我", comment.author === "我" ? "" : "open-character", comment.author === "我" ? "" : comment.author)}
          <div class="comment-body">
            <strong>${comment.author}</strong>
            <p>${renderRichText(comment.content)}</p>
            <div class="comment-meta">
              <span>${comment.time || "刚刚"}</span>
              ${comment.author !== "我" ? `<button class="comment-reply-btn" data-action="reply-to-comment" data-comment-id="${comment.id}">回复TA</button>` : ""}
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
    孔子: "常在你发情绪和人生感悟类动态时优先出现",
    李白: "夜晚更活跃，适合在你深夜发帖时来评论你",
    貂蝉: "对美妆、情绪和社交类内容响应最积极",
    华佗: "在你熬夜、疲惫或健康相关动态下经常出现",
    武则天: "擅长给你成长、判断与掌控感方向的回应",
    李清照: "在低落、想念与细腻情绪话题中最有共鸣",
    狄仁杰: "会在复杂问题和关系误会里给出清晰拆解",
    苏轼: "适合生活感、治愈感、想被安慰的时候出现",
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
      <span class="stat-pill">亲密度 ${character.intimacy}</span>
    </div>
    <p>${character.intro || ""}</p>
    <div class="character-actions">
      <button class="primary-btn small wide">${owned ? "已在我的朋友圈" : "加入我的朋友圈"}</button>
      <button class="secondary-btn small wide">设置为特别关注</button>
    </div>
  `;

  relationshipCard.innerHTML = `
    <span class="eyebrow accent">你和 TA 的关系</span>
    <h3>${owned ? "已经是你的常驻朋友圈居民" : "还没有加入你的角色阵容"}</h3>
    <p>${moodLineMap[name] || "TA 会根据你发帖的内容主题，选择适合的时候出现并评论你。"}</p>
    <div class="relationship-metrics">
      <div>
        <strong>${character.intimacy}</strong>
        <span>当前亲密度</span>
      </div>
      <div>
        <strong>${owned ? "高" : "中"}</strong>
        <span>出场意愿</span>
      </div>
      <div>
        <strong>${character.tags[0]}</strong>
        <span>最擅长话题</span>
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
    showToast("今天的免费次数已经用完了");
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
  showToast("新角色已入驻你的朋友圈");
}

async function createUserPost(content) {
  const trimmed = content.trim();
  if (!trimmed) {
    showToast("先写点内容再发布吧");
    return;
  }
  setButtonBusy(publishBtn, true, "发布中...", "发布");
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
      showToast(`已发布，${result.aiCommentCount} 位角色已来互动`);
    } else if (result.aiCommentError) {
      showToast("已发布成功，AI 互动稍后补上");
    } else if (appState.modelReady) {
      showToast("已发布，AI 角色正在赶来评论");
      pollPostUpdates(result.post.id, result.post.comments?.length || 0);
    } else {
      showToast("已发布，配置模型后将生成真实 AI 互动");
    }
  } finally {
    setButtonBusy(publishBtn, false, "发布中...", "发布");
  }
}

function openLatestUserPost() {
  const latestUserPost = appState.feed.find((post) => post.author === "我");
  if (!latestUserPost) {
    showToast("你还没有发布动态，先去发一条吧");
    switchTab("home");
    return;
  }
  openDetail(latestUserPost.id);
}

async function handleReply() {
  const text = replyInput.value.trim();
  if (!appState.currentPostId) {
    showToast("先打开一条动态再评论");
    return;
  }
  if (!text) {
    showToast("输入点内容再发送");
    return;
  }
  setButtonBusy(replyBtn, true, "发送中...", "发送");
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
          result.aiReplyCount > 1 ? `${targetedName} 先接话了，另外 ${result.aiReplyCount - 1} 位也跟上了` : `${targetedName} 已经先回复你了`
        );
      } else {
        showToast(result.aiReplyCount > 1 ? `${result.aiReplyCount} 位角色已经接话` : "评论已发送，角色马上接话了");
      }
    } else if (result.aiReplyError) {
      showToast("评论已发送，AI 回复稍后补上");
      pollPostUpdates(result.post.id, result.post.comments?.length || 0);
    } else {
      showToast("评论已发送");
      pollPostUpdates(result.post.id, result.post.comments?.length || 0);
    }
  } finally {
    setButtonBusy(replyBtn, false, "发送中...", "发送");
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
      showToast(target.dataset.message || "功能已预留");
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
      showToast("未检测到豆包配置，请先填写 .env 后启动后端");
    }
    switchTab("home");
  } catch (error) {
    console.error(error);
    showToast(`初始化失败: ${error.message}`);
  }
}

initApp();
