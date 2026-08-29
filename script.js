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
    renderer.setSize(210, 210);
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
    if (avatarMesh) {
        if (!isDragging) {
            currentRotationVelocity += (targetRotationVelocity - currentRotationVelocity) * 0.05;
            avatarMesh.rotation.y += currentRotationVelocity;
            avatarMesh.rotation.x *= 0.95;
        }
    }
    renderer.render(scene, camera);
}

// Reliable proxy using corsproxy.io which handles POST and headers cleanly
async function robloxFetch(url, options = {}) {
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl, options);
    if (!response.ok) throw new Error('API connection rejected.');
    return await response.json();
}

async function performSearch() {
    const username = usernameInput.value.trim();
    if (!username) return;

    loader.classList.remove('hidden');
    errorContainer.classList.add('hidden');
    profileContainer.classList.add('hidden');

    try {
        // Step 1: Lookup User ID via POST endpoint through corsproxy.io
        const lookupUrl = `https://users.roblox.com/v1/usernames/users`;
        const proxyLookupUrl = `https://corsproxy.io/?${encodeURIComponent(lookupUrl)}`;
        
        const userLookupRes = await fetch(proxyLookupUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usernames: [username], excludeBannedUsers: false })
        });
        
        if (!userLookupRes.ok) throw new Error('Failed to resolve username.');
        const userData = await userLookupRes.json();

        if (!userData.data || userData.data.length === 0) {
            throw new Error('Target user profile not located in database.');
        }

        const userId = userData.data[0].id;
        const displayName = userData.data[0].displayName;
        const name = userData.data[0].name;

        // Step 2: Fetch extended stats safely using parallel requests
        const [
            profile, avatar, followers, friends,
            presence, usernameHistory, avatarRig, groups, games
        ] = await Promise.all([
            robloxFetch(`https://users.roblox.com/v1/users/${userId}`),
            robloxFetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png&isCircular=false`),
            robloxFetch(`https://friends.roblox.com/v1/users/${userId}/followers/count`),
            robloxFetch(`https://friends.roblox.com/v1/users/${userId}/friends/count`),
            robloxFetch(`https://presence.roblox.com/v1/presence/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userIds: [userId] })
            }),
            robloxFetch(`https://users.roblox.com/v1/users/${userId}/username-history`),
            robloxFetch(`https://avatar.roblox.com/v2/avatar/users/${userId}/avatar`),
            robloxFetch(`https://groups.roblox.com/v1/users/${userId}/groups/roles`),
            robloxFetch(`https://games.roblox.com/v1/users/${userId}/games?limit=6`)
        ]);

        document.getElementById('displayName').textContent = displayName;
        document.getElementById('userName').textContent = `@${name}`;

        const badgeEl = document.getElementById('verifiedBadge');
        if (profile.hasVerifiedBadge) {
            badgeEl.classList.remove('hidden');
        } else {
            badgeEl.classList.add('hidden');
        }

        let avatarUrl = 'https://tr.rbxcdn.com/30day-avatar/420/420/AvatarHeadshot/Png';
        if (avatar.data && avatar.data.length > 0) {
            avatarUrl = avatar.data[0].imageUrl;
        }
        init3DViewer(avatarUrl);

        const createdDate = new Date(profile.created).toLocaleDateString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric'
        });
        document.getElementById('createdDate').textContent = createdDate;

        document.getElementById('followersCount').textContent = followers.count?.toLocaleString() || '0';
        document.getElementById('friendsCount').textContent = friends.count?.toLocaleString() || '0';
        document.getElementById('rigType').textContent = avatarRig.playerAvatarType || 'Unknown';

        const userPresence = presence.userPresences?.[0];
        const statusEl = document.getElementById('onlineStatus');
        const lastOnlineEl = document.getElementById('lastOnline');

        if (userPresence) {
            if (userPresence.userPresenceType > 0) {
                statusEl.textContent = userPresence.userPresenceType === 2 ? 'IN-GAME' : 'ONLINE';
                statusEl.className = 'status-pill online';
                lastOnlineEl.textContent = userPresence.lastLocation ? `Playing: ${userPresence.lastLocation}` : 'Active on Web';
            } else {
                statusEl.textContent = 'OFFLINE';
                statusEl.className = 'status-pill offline';
                lastOnlineEl.textContent = userPresence.lastOnline ? new Date(userPresence.lastOnline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Restricted';
            }
        }

        const pastNamesContainer = document.getElementById('pastUsernames');
        if (usernameHistory.data && usernameHistory.data.length > 0) {
            pastNamesContainer.innerHTML = usernameHistory.data.map(item => `<span class="tag">${item.name}</span>`).join('');
        } else {
            pastNamesContainer.innerHTML = '<span class="empty-hint">No past aliases detected</span>';
        }

        const groupsContainer = document.getElementById('groupsList');
        if (groups.data && groups.data.length > 0) {
            groupsContainer.innerHTML = groups.data.slice(0, 4).map(g => `<span class="tag" title="${g.role.name}">${g.group.name}</span>`).join('');
        } else {
            groupsContainer.innerHTML = '<span class="empty-hint">No public organizations</span>';
        }

        let totalVisits = 0;
        const gamesContainer = document.getElementById('gamesContainer');
        if (games.data && games.data.length > 0) {
            gamesContainer.innerHTML = games.data.map(game => {
                totalVisits += game.placeVisits || 0;
                return `
                    <div class="exp-card">
                        <h4>${game.name}</h4>
                        <p>Visits: ${(game.placeVisits || 0).toLocaleString()}</p>
                    </div>
                `;
            }).join('');
        } else {
            gamesContainer.innerHTML = '<span class="empty-hint">No public developer experiences found</span>';
        }
        document.getElementById('placeVisits').textContent = totalVisits.toLocaleString();

        loader.classList.add('hidden');
        profileContainer.classList.remove('hidden');

    } catch (err) {
        loader.classList.add('hidden');
        errorContainer.textContent = err.message || 'Telemetry scan failed. Please verify the username.';
        errorContainer.classList.remove('hidden');
    }
}
