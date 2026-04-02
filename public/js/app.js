const apiCall = async (service, action, path = null, data = null, email = null, password = null) => {
    const res = await fetch('/api/core', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service, action, path, data, email, password })
    });
    return await res.json();
};

const uploadMedia = async (fileBase64, isVideo, type) => {
    const res = await fetch('/api/core', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: 'upload', fileBase64, isVideo, type })
    });
    return await res.json();
};

const moderateContent = (base64) => {
    return true; 
};

let currentUserData = null;
let lastPostTime = 0;

const initApp = async () => {
    const uid = localStorage.getItem('coders_uid');
    if (!uid) {
        window.location.href = '/';
        return;
    }
    
    const res = await apiCall('db', 'get', `users/${uid}`);
    if (!res.success || !res.data) {
        localStorage.removeItem('coders_uid');
        window.location.href = '/';
        return;
    }

    currentUserData = res.data;

    if (currentUserData.banned) {
        document.getElementById('bannedOverlay').style.display = 'flex';
        return;
    }

    updateUI();
    loadPosts();
};

const updateUI = () => {
    const elements = document.querySelectorAll('.user-avatar, .post-avatar');
    elements.forEach(el => {
        if(currentUserData.avatarUrl) el.style.backgroundImage = `url(${currentUserData.avatarUrl})`;
    });
    const urlParams = new URLSearchParams(window.location.search);
    if(!urlParams.has('user')) {
        window.history.replaceState({}, '', `/home?user=${currentUserData.userIndex || Date.now()}`);
    }
};

const loadPosts = async () => {
    const res = await apiCall('db', 'get', 'posts');
    if (res.success && res.data) {
        const feed = document.getElementById('postFeed');
        feed.innerHTML = '';
        Object.keys(res.data).reverse().forEach(key => {
            const post = res.data[key];
            const div = document.createElement('div');
            div.className = 'post';
            div.innerHTML = `
                <div class="post-avatar" style="background-image: url('${post.avatar || ''}')"></div>
                <div class="post-content">
                    <div class="post-header">
                        <div class="post-author">${post.author} ${post.role !== 'member' ? '<i class="fas fa-check-circle blue-check-badge"></i>' : ''}</div>
                        <div class="post-time">${new Date(post.timestamp).toLocaleString()}</div>
                    </div>
                    <div class="post-text">${post.text}</div>
                    ${post.mediaUrl ? (post.isVideo ? `<video src="${post.mediaUrl}" onclick="openMedia('${post.mediaUrl}', true)" style="max-width:100%; border-radius:10px; margin-top:10px;"></video>` : `<img src="${post.mediaUrl}" onclick="openMedia('${post.mediaUrl}', false)" style="max-width:100%; border-radius:10px; margin-top:10px;">`) : ''}
                    ${post.uid === currentUserData.uid || currentUserData.role === 'developer' || currentUserData.role === 'owner' ? `<button onclick="deletePost('${key}')" style="margin-top:10px; background:red; color:white; border:none; padding:5px; border-radius:5px; cursor:pointer;">Hapus</button>` : ''}
                </div>
            `;
            feed.appendChild(div);
        });
    }
};

const createPost = async () => {
    const now = Date.now();
    if (now - lastPostTime < 30000) {
        alert('Tunggu 30 detik');
        return;
    }

    const text = document.getElementById('postInput').value;
    const fileInput = document.getElementById('mediaUploadInput').files[0];
    
    if (!text && !fileInput) return;

    let mediaUrl = null;
    let isVideo = false;

    if (fileInput) {
        const reader = new FileReader();
        const base64 = await new Promise(r => {
            reader.onload = e => r(e.target.result);
            reader.readAsDataURL(fileInput);
        });

        if (!moderateContent(base64)) {
            alert('Dilarang');
            return;
        }

        isVideo = fileInput.type.startsWith('video');
        const uploadRes = await uploadMedia(base64, isVideo, 'post');
        if (uploadRes.success) mediaUrl = uploadRes.url;
    }

    const postData = {
        uid: currentUserData.uid,
        author: currentUserData.username,
        avatar: currentUserData.avatarUrl || '',
        role: currentUserData.role,
        text,
        mediaUrl,
        isVideo,
        timestamp: now
    };

    const res = await apiCall('db', 'push', 'posts', postData);
    if (res.success) {
        lastPostTime = now;
        document.getElementById('postInput').value = '';
        document.getElementById('mediaUploadInput').value = '';
        loadPosts();
    }
};

const deletePost = async (key) => {
    const res = await apiCall('db', 'delete', `posts/${key}`);
    if (res.success) loadPosts();
};

const openMedia = (url, isVideo) => {
    const overlay = document.getElementById('mediaOverlay');
    const content = document.getElementById('mediaContent');
    content.innerHTML = isVideo ? `<video src="${url}" controls autoplay style="max-width:90%; max-height:90%; border-radius:10px;"></video>` : `<img src="${url}" style="max-width:90%; max-height:90%; border-radius:10px;">`;
    overlay.style.display = 'flex';
};

const closeMedia = () => {
    document.getElementById('mediaOverlay').style.display = 'none';
    document.getElementById('mediaContent').innerHTML = '';
};

const logoutBanned = () => {
    localStorage.removeItem('coders_uid');
    window.location.href = '/';
};

const logout = () => {
    localStorage.removeItem('coders_uid');
    window.location.href = '/';
};

if(document.getElementById('postSubmit')) {
    document.getElementById('postSubmit').addEventListener('click', createPost);
}

if(window.location.pathname.includes('home')) {
    initApp();
}const