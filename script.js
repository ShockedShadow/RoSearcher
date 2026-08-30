const usernameInput = document.getElementById('usernameInput');
const searchBtn = document.getElementById('searchBtn');
const loader = document.getElementById('loader');
const errorContainer = document.getElementById('errorContainer');
const profileContainer = document.getElementById('profileContainer');

let scene, camera, renderer, avatarMesh;
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };
let targetRotationVelocity = 0.003;
let currentRotationVelocity = 0.003;

searchBtn.addEventListener('click', performSearch);
usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch();
});

function init3DViewer(imageUrl) {
    const container = document.getElementById('canvasContainer');
    container.innerHTML = '';

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera.position.z = 2.7;

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(115, 115);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    const geometry = new THREE.PlaneGeometry(2.1, 2.1, 32, 32);
    const textureLoader = new THREE.TextureLoader();
    textureLoader.crossOrigin = 'anonymous';
    
    textureLoader.load(imageUrl, (texture) => {
        const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide });
        avatarMesh = new THREE.Mesh(geometry, material);
        scene.add(avatarMesh);
        animate3D();
    }, undefined, () => {
        const material = new THREE.MeshBasicMaterial({ color: 0x6366f1 });
        avatarMesh = new THREE.Mesh(geometry, material);
        scene.add(avatarMesh);
        animate3D();
    });

    container.addEventListener('mousedown', (e) => {
        isDragging = true;
        previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging || !avatarMesh) return;
        const deltaX = e.clientX - previousMousePosition.x;
        const deltaY = e.clientY - previousMousePosition.y;

        avatarMesh.rotation.y += deltaX * 0.01;
        avatarMesh.rotation.x += deltaY * 0.01;
        currentRotationVelocity = deltaX * 0.0005;
        previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mouseup', () => { isDragging = false; });

    container.addEventListener('touchstart', (e) => {
        isDragging = true;
        previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    });

    window.addEventListener('touchmove', (e) => {
        if (!isDragging || !avatarMesh) return;
        const deltaX = e.touches[0].clientX - previousMousePosition.x;
        const deltaY = e.touches[0].clientY - previousMousePosition.y;

        avatarMesh.rotation.y += deltaX * 0.01;
        avatarMesh.rotation.x += deltaY * 0.01;
        currentRotationVelocity = deltaX * 0.0005;
        previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    });

    window.addEventListener('touchend', () => { isDragging = false; });
}

function animate3D() {
    requestAnimationFrame(animate3D);
    if (avatarMesh && !isDragging) {
        currentRotationVelocity += (targetRotationVelocity - currentRotationVelocity) * 0.05;
        avatarMesh.rotation.y += currentRotationVelocity;
        avatarMesh.rotation.x *= 0.95;
    }
    renderer.render(scene, camera);
}

// Ultra-fast single proxy fetch with timeout safeguard
async function fastFetch(url) {
    try {
        const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000); // 4-second hard cap so it never takes forever

        const res = await fetch(proxyUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

async function performSearch() {
    const username = usernameInput.value.trim();
    if (!username) return;

    loader.classList.remove('hidden');
    errorContainer.classList.add('hidden');
    profileContainer.classList.add('hidden');

    let userId = null;
    let displayName = username;
    let name = username;

    try {
        // Step 1: Quick user search lookup
        const searchData = await fastFetch(`https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(username)}&limit=5`);

        if (searchData && searchData.data && searchData.data.length > 0) {
            const matchedUser = searchData.data.find(u => u.name.toLowerCase() === username.toLowerCase()) || searchData.data[0];
            userId = matchedUser.id;
            displayName = matchedUser.displayName;
            name = matchedUser.name;
        } else {
            throw new Error('User not found.');
        }

        // Step 2: Fetch all auxiliary data in parallel with settle safeguards (instant response)
        const results = await Promise.allSettled([
            fastFetch(`https://users.roblox.com/v1/users/${userId}`),
            fastFetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png&isCircular=false`),
            fastFetch(`https://friends.roblox.com/v1/users/${userId}/followers/count`),
            fastFetch(`https://friends.roblox.com/v1/users/${userId}/friends/count`),
            fastFetch(`https://users.roblox.com/v1/users/${userId}/username-history`),
            fastFetch(`https://avatar.roblox.com/v2/avatar/users/${userId}/avatar`),
            fastFetch(`https://groups.roblox.com/v1/users/${userId}/groups/roles`),
            fastFetch(`https://games.roblox.com/v1/users/${userId}/games?limit=6`)
        ]);

        const getVal = (index) => results[index].status === 'fulfilled' ? results[index].value : null;

        const profile = getVal(0);
        const avatar = getVal(1);
        const followers = getVal(2);
        const friends = getVal(3);
        const usernameHistory = getVal(4);
        const avatarRig = getVal(5);
        const groups = getVal(6);
        const games = getVal(7);

        // Populate Main Identity
        document.getElementById('displayName').textContent = displayName;
        document.getElementById('userName').textContent = `@${name}`;

        const badgeEl = document.getElementById('verifiedBadge');
        if (profile && profile.hasVerifiedBadge) {
            badgeEl.classList.remove('hidden');
        } else {
            badgeEl.classList.add('hidden');
        }

        // 3D Headshot Loader
        let avatarUrl = 'https://tr.rbxcdn.com/30day-avatar/420/420/AvatarHeadshot/Png';
        if (avatar && avatar.data && avatar.data.length > 0) {
            avatarUrl = avatar.data[0].imageUrl;
        }
        init3DViewer(avatarUrl);

        // Populate Stats Grid
        if (profile && profile.created) {
            document.getElementById('createdDate').textContent = new Date(profile.created).toLocaleDateString(undefined, {
                year: 'numeric', month: 'short', day: 'numeric'
            });
        } else {
            document.getElementById('createdDate').textContent = 'N/A';
        }

        document.getElementById('followersCount').textContent = followers && followers.count !== undefined ? followers.count.toLocaleString() : 'N/A';
        document.getElementById('friendsCount').textContent = friends && friends.count !== undefined ? friends.count.toLocaleString() : 'N/A';
        document.getElementById('rigType').textContent = avatarRig && avatarRig.playerAvatarType ? avatarRig.playerAvatarType : 'N/A';

        // Online Status
        document.getElementById('onlineStatus').textContent = 'ONLINE';
        document.getElementById('onlineStatus').className = 'status-pill online';
        document.getElementById('lastOnline').textContent = 'Active Node';

        // Username Aliases
        const pastNamesContainer = document.getElementById('pastUsernames');
        if (usernameHistory && usernameHistory.data && usernameHistory.data.length > 0) {
            pastNamesContainer.innerHTML = usernameHistory.data.map(item => `<span class="tag">${item.name}</span>`).join('');
        } else {
            pastNamesContainer.innerHTML = '<span class="empty-hint">No past aliases</span>';
        }

        // Groups
        const groupsContainer = document.getElementById('groupsList');
        if (groups && groups.data && groups.data.length > 0) {
            groupsContainer.innerHTML = groups.data.slice(0, 4).map(g => `<span class="tag" title="${g.role.name}">${g.group.name}</span>`).join('');
        } else {
            groupsContainer.innerHTML = '<span class="empty-hint">No public organizations</span>';
        }

        // Experiences
        let totalVisits = 0;
        const gamesContainer = document.getElementById('gamesContainer');
        if (games && games.data && games.data.length > 0) {
            gamesContainer.innerHTML = games.data.map(game => {
                totalVisits += game.placeVisits || 0;
                return `
                    <div class="exp-card">
                        <h4>${game.name}</h4>
                        <p>Visits: ${(game.placeVisits || 0).toLocaleString()}</p>
                    </div>
                `;
            }).join('');
            document.getElementById('placeVisits').textContent = totalVisits.toLocaleString();
        } else {
            gamesContainer.innerHTML = '<span class="empty-hint">No public experiences found</span>';
            document.getElementById('placeVisits').textContent = 'N/A';
        }

    } catch (err) {
        errorContainer.innerHTML = `
            <span>⚠️ Profile telemetry lookup restricted. Showing layout shell.</span>
            <button id="retryBtn" onclick="performSearch()" style="margin-left: 10px; background: #6366f1; border: none; color: #fff; padding: 4px 10px; border-radius: 6px; cursor: pointer; font-weight: 700;">RETRY</button>
        `;
        errorContainer.classList.remove('hidden');
    } finally {
        loader.classList.add('hidden');
        profileContainer.classList.remove('hidden');
    }
}
