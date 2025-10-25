$(function() {
   // スクロールしたときに実行
   $(window).scroll(function () {
      // 目的のスクロール量を設定(px)
      var TargetPos = 350;
      // 現在のスクロール位置を取得
      var ScrollPos = $(window).scrollTop();
      // 現在位置が目的のスクロール量に達しているかどうかを判断
      if( ScrollPos >= TargetPos) {
         // 達していれば表示
         $("#topbutton").fadeIn();
      }
      else {
         // 達していなければ非表示
         $("#topbutton").fadeOut();
      }
   });
});
'use strict';

// ====== 設定 ======
const BASE = "https://script.google.com/macros/s/AKfycbxHtFveke2AYiMP4riB1xpEgv8N6EzzntmDBdo5L8DZP8LygIN5I3SCHB4eSGl4jC_y/exec"; // ←自分の/execに
const USE_API_FOR_COMMENTS = true;     // コメントもSheetsでやる場合は true（修正済み）

// ====== 状態 ======
let posts = [];                  // [{id, title, content, author, date}]
let comments = {};               // { [postId]: [{id, content, author, date}] }

// ====== 必要な関数のみグローバル公開 ======
window.listPosts = listPosts;
window.createPost = createPost;
window.deletePost = deletePost;
window.listComments = listComments;
window.createComment = createComment;


// ====== 汎用fetch（プリフライト回避のためヘッダは付けない） ======
async function fetchJSON(url, options = {}) {
  const init = {};
  if (options.body !== undefined) {
    init.method = options.method || "POST";
    init.body = (typeof options.body === "string") ? options.body : JSON.stringify(options.body);
  } else {
    init.method = options.method || "GET";
  }
  const r = await fetch(url, init);
  const text = await r.text();
  let json = {};
  try { json = text ? JSON.parse(text) : {}; } catch (e) {
    throw new Error(`Parse error: ${e.message}\nRAW: ${text}`);
  }
  if (!r.ok || json.ok === false) {
    throw new Error((json.error || json.message || `${r.status} ${r.statusText}`));
  }
  return json;
}


// ====== Posts API ======
async function listPosts() {
  const url = `${BASE}?op=list`;
  const res = await fetchJSON(url);
  return res.data || [];
}
async function createPost(post) {
  const res = await fetchJSON(`${BASE}`, { body: { op: "create", post } });
  return res; // {ok:true, id}
}
async function deletePost(id) {
  const res = await fetchJSON(`${BASE}`, { body: { op: "delete", id } });
  return res;
}

// ====== Comments API or localStorage ======
const LS_COMMENTS = "schoolHelper_comments";

async function listComments(postId) {
  if (USE_API_FOR_COMMENTS) {
    const url = `${BASE}?op=comments_list&post_id=${encodeURIComponent(postId)}`;
    const res = await fetchJSON(url);
    return res.data || [];
  }
  const saved = JSON.parse(localStorage.getItem(LS_COMMENTS) || "{}");
  return saved[String(postId)] || [];
}
async function createComment(postId, comment) {
  if (USE_API_FOR_COMMENTS) {
    return await fetchJSON(`${BASE}`, { body: { op: "comments_create", post_id: postId, comment } });
  }
  const saved = JSON.parse(localStorage.getItem(LS_COMMENTS) || "{}");
  const arr = saved[String(postId)] || [];
  const id = (arr.at(-1)?.id || 0) + 1;
  arr.push({ id, ...comment });
  saved[String(postId)] = arr;
  localStorage.setItem(LS_COMMENTS, JSON.stringify(saved));
  return { ok: true, id };
}


// ====== ヘルパ関数 ======
function getPostsListElement() {
  return document.getElementById("posts-container");
}

// ====== Loading表示制御 ======
function showLoading(container, message = "読み込み中...") {
  if (!container) return;
  container.innerHTML = `
    <div class="loading-container">
      <div class="loading-spinner-large"></div>
      ${message}
    </div>
  `;
}


function setButtonLoading(button, isLoading, originalText = '') {
  if (!button) return;
  if (isLoading) {
    button.disabled = true;
    button.innerHTML = `<span class="loading-inline"><span class="loading-spinner"></span>投稿中...</span>`;
  } else {
    button.disabled = false;
    button.innerHTML = originalText || '💬 コメント投稿';
  }
}

// ====== 画面フック ======
document.addEventListener("DOMContentLoaded", async () => {
  // 一覧描画要素の取得
  const listEl = getPostsListElement();

  // データ読み込み
  try {
    posts = await listPosts();
    comments = {};

    // 一覧描画
    if (listEl) renderPostsList(listEl, posts);
  } catch (err) {
    posts = [];
    comments = {};

    // エラー表示
    if (listEl) {
      listEl.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">データの読み込みに失敗しました</p>';
    }
  }

  // 投稿フォーム（post.html）
  const form = document.getElementById("post-form");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const title = form.querySelector("[name=title]")?.value?.trim() || "";
      const content = form.querySelector("[name=content]")?.value?.trim() || "";
      const author = form.querySelector("[name=author]")?.value?.trim() || "匿名";
      if (!title) return alert("タイトルを入力してください");

      const post = { title, content, author, date: new Date().toISOString().slice(0,10) };
      const res = await createPost(post);
      post.id = res.id;
      posts.push(post);

      // 投稿後は一覧へ遷移
      location.assign("index.html");
    });
  }

  // 詳細ページ用のクエリパラメータ取得
  const qs = new URLSearchParams(location.search);
  const id = Number(qs.get("id"));

  // コメントフォーム（detail.html）
  const commentForm = document.getElementById("comment-form");
  if (commentForm) {
    commentForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const postId = id;
      if (!postId) return alert("投稿IDが見つかりません");

      const author = commentForm.querySelector("[name=comment-author]")?.value?.trim() || "";
      const content = commentForm.querySelector("[name=comment-content]")?.value?.trim() || "";

      if (!author) return alert("お名前を入力してください");
      if (!content) return alert("解決アイデアを入力してください");

      const comment = {
        content,
        author,
        date: new Date().toISOString().slice(0,16).replace('T', ' ')
      };

      const submitBtn = commentForm.querySelector('button[type="submit"]');
      const commentsEl = document.getElementById("comments-container");

      try {
        // ボタンをLoading状態にする
        setButtonLoading(submitBtn, true);

        const res = await createComment(postId, comment);
        if (res.ok) {
          // コメント一覧にLoading表示
          if (commentsEl) showLoading(commentsEl, "コメントを更新中...");

          // コメント一覧を再表示
          const arr = await listComments(postId);
          comments[postId] = arr;
          if (commentsEl) renderComments(commentsEl, arr);

          // フォームをリセット
          commentForm.reset();
        } else {
          throw new Error("コメントの投稿に失敗しました");
        }
      } catch (error) {
        alert("コメント投稿中にエラーが発生しました。");
      } finally {
        // ボタンをLoading状態から戻す
        setButtonLoading(submitBtn, false);
      }
    });
  }

  // 詳細ページ
  const detailEl = document.getElementById("post-detail");
  if (detailEl && id) {
    const p = posts.find(x => x.id === id);
    if (p) {
      detailEl.innerHTML = `
        <h2>${escapeHtml(p.title)}</h2>
        <p>${nl2br(escapeHtml(p.content))}</p>
        <div class="meta">by ${escapeHtml(p.author)} / ${escapeHtml(p.date)}</div>
      `;
    } else {
      detailEl.innerHTML = '<p style="color: #666;">投稿が見つかりませんでした。</p>';
    }
  }

  if (id) {
    const commentsEl = document.getElementById("comments-container");
    if (commentsEl) {
      try {
        const arr = await listComments(id);
        comments[id] = arr;
        renderComments(commentsEl, arr);
      } catch (error) {
        commentsEl.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">コメントの読み込みに失敗しました</p>';
      }
    }
  }
});

// 戻る/再表示時にも最新化
window.addEventListener("pageshow", async (e) => {
  const listEl = getPostsListElement();
  if (listEl && e.persisted) {
    try {
      showLoading(listEl, "最新データを読み込み中...");
      posts = await listPosts();
      renderPostsList(listEl, posts);
    } catch (err) {
      listEl.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">データの読み込みに失敗しました</p>';
    }
  }
});

function renderPostsList(container, data) {

const card = (p) => `
  <div class="post-card" data-id="${p.id}"
       style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 2px 8px rgba(0,0,0,.06);margin:12px 0;">
    <a class="post-title" data-id="${p.id}" href="detail.html?id=${p.id}"
       style="display:block;font-weight:700;color:#2b3a67;text-decoration:none;cursor:pointer;padding:4px 0;">
      ${escapeHtml(p.title)}
    </a>
    <div class="meta" style="color:#666;font-size:12px;margin-top:4px;">
      投稿者: ${escapeHtml(p.author || '—')} ／ 投稿日: ${escapeHtml(p.date || '')}
    </div>
    <p style="margin:8px 0 0 0;">${excerpt(p.content, 90)}</p>
    <div style="text-align:right;margin-top:8px;">
      <button type="button" data-action="del"
        style="background:none;border:none;color:#a00;cursor:pointer">削除</button>
    </div>
  </div>
`;

const sortedData = (data || []).sort((a, b) => {
  const aId = Number(a.id) || 0;
  const bId = Number(b.id) || 0;
  return bId - aId;
});
container.innerHTML = sortedData.map(card).join("");

// クリック委譲：aクリックは明示的に遷移、削除ボタンだけJS処理
container.onclick = async (e) => {
  const delBtn = e.target.closest("button[data-action=del]");
  if (delBtn) {
    const postCard = delBtn.closest("div.post-card");
    const id = Number(postCard?.dataset?.id);
    if (!id || !confirm("この投稿を削除しますか？")) return;
    await deletePost(id);
    posts = posts.filter(x => x.id !== id);
    renderPostsList(container, posts);
    return;
  }

  const link = e.target.closest("a.post-title");
  const postCard = e.target.closest("div.post-card");

  if (link) {
    // タイトルリンクがクリックされた場合
    e.preventDefault();
    const id = link.dataset.id;
    if (id) {
      window.location.href = `detail.html?id=${id}`;
    }
  } else if (postCard && !e.target.closest("button[data-action=del]")) {
    // post-card内の他の部分がクリックされた場合（削除ボタン以外）
    const id = postCard.dataset.id;
    if (id) {
      window.location.href = `detail.html?id=${id}`;
    }
  }
};}


function renderComments(container, arr) {
  const sortedComments = (arr || []).sort((a, b) => {
    const aId = Number(a.id) || 0;
    const bId = Number(b.id) || 0;
    return aId - bId;
  });
  container.innerHTML = sortedComments.map(c => `
    <div class="comment-item" data-id="${c.id}">
      <div class="comment-meta">👤 ${escapeHtml(c.author)} • 📅 ${escapeHtml(c.date || "")}</div>
      <div class="comment-content">${nl2br(escapeHtml(c.content))}</div>
    </div>
  `).join("");
}

// ====== ヘルパ ======
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function nl2br(s){ return String(s).replace(/\n/g, "<br>"); }
function excerpt(text, n){
  if (!text) return '';
  const s = String(text).replace(/\s+/g,' ').trim();
  return s.length > n ? `${escapeHtml(s.slice(0,n))}…` : escapeHtml(s);
}
