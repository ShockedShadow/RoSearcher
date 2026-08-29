const usernameInput = document.getElementById('usernameInput');
const searchBtn = document.getElementById('searchBtn');
const loader = document.getElementById('loader');
const errorContainer = document.getElementById('errorContainer');
const profileContainer = document.getElementById('profileContainer');

// Three.js Global Variables for 3D Viewport
let scene, camera, renderer, avatarMesh;
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };
let targetRotationVelocity = 0.003; // Base auto-spin speed
let currentRotationVelocity = 0.003;

searchBtn.addEventListener('click', performSearch);
usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch();
});

// Initialize 3D Viewport Canvas
function init3DViewer(imageUrl) {
    const container = document.getElementById('canvasContainer');
    container.innerHTML = ''; // Clear previous canvas if any

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera.position.z = 2.7;

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(220, 220);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // Create a sleek rounded avatar display card mesh in 3D space
    const geometry = new THREE.PlaneGeometry(2.1, 2.1, 32, 32);
    
    const textureLoader = new THREE.TextureLoader();
    textureLoader.crossOrigin = 'anonymous';
    
    textureLoader.load(imageUrl, (texture) => {
        const material = new THREE.MeshBasicMaterial({ 
            map: texture, 
            transparent: true,
            side: THREE.DoubleSide
        });
        avatarMesh = new THREE.Mesh(geometry, material);
        scene.add(avatarMesh);
        animate3D();
    }, undefined, () => {
        // Fallback placeholder if texture fails
        const material = new THREE.MeshBasicMaterial({ color: 0x6366f1 });
        avatarMesh = new THREE.Mesh(geometry, material);
        scene.add(avatarMesh);
        animate3D();
    });

    // Mouse / Touch Event Listeners for 3D Interaction
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

        currentRotationVelocity = deltaX * 0.0005; // Transfer momentum
        previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
    });

    // Touch support for mobile devices
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

    window.addEventListener('touchend', () => {
        isDragging = false;
    });
}

function animate3D() {
    requestAnimationFrame(animate3D);
    if (avatarMesh) {
        if (!isDragging) {
            // Gradually return momentum to the slow default auto-spin
            currentRotationVelocity += (targetRotationVelocity - currentRotationVelocity) * 0.05;
            avatarMesh.rotation.y += currentRotationVelocity;
            
            // Gently level out the X axis rotation over time if twisted
            avatarMesh.rotation.x *= 0.95;
        }
    }
    renderer.render(scene, camera);
}

async function performSearch() {
    const username = usernameInput.value.trim();
    if (!username) return;

    loader.classList.remove('hidden');
    errorContainer.classList.add('hidden');
    profileContainer.classList.add('hidden');

    try {
        const userLookupRes = await fetch(`https://users.roblox.com/v1/usernames/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usernames: [username], excludeBannedUsers: false })
        });
        const userData = await userLookupRes.json();

        if (!userData.data || userData.data.length === 0) {
            throw new Error('Roblox user not found!');
        }

        const userId = userData.data[0].id;
        const displayName = userData.data[0].displayName;
        const name = userData.data[0].name;

        const [
            profileRes,
            avatarRes,
            followersRes,
            friendsRes,
            presenceRes,
            usernameHistoryRes,
            avatarRigRes,
            groupsRes,
            gamesRes
        ] = await Promise.all([
            fetch(`https://users.roblox.com/v1/users/${userId}`),
            fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png&isCircular=false`),
            fetch(`https://friends.roblox.com/v1/users/${userId}/followers/count`),
            fetch(`https://friends.roblox.com/v1/users/${userId}/friends/count`),
            fetch(`https://presence.roblox.com/v1/presence/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userIds: [userId] })
            }),
            fetch(`https://users.roblox.com/v1/users/${userId}/username-history`),
            fetch(`https://avatar.roblox.com/v2/avatar/users/${userId}/avatar`),
            fetch(`https://groups.roblox.com/v1/users/${userId}/groups/roles`),
            fetch(`https://games.roblox.com/v1/users/${userId}/games?limit=6`)
        ]);

        const profile = await profileRes.json();
        const avatar = await avatarRes.json();
        const followers = await followersRes.json();
        const friends = await friendsRes.json();
        const presence = await presenceRes.json();
        const usernameHistory = await usernameHistoryRes.json();
        const avatarRig = await avatarRigRes.json();
        const groups = await groupsRes.json();
        const games = await gamesRes.json();

        document.getElementById('displayName').textContent = displayName;
        document.getElementById('userName').textContent = `@${name}`;

        const badgeEl = document.getElementById('verifiedBadge');
        if (profile.hasVerifiedBadge) {
            badgeEl.classList.remove('hidden');
        } else {
            badgeEl.classList.add('hidden');
        }

        // Initialize 3D Rotating Avatar Viewport
        let avatarUrl = 'https://tr.rbxcdn.com/30day-avatar/420/420/AvatarHeadshot/Png';
        if (avatar.data && avatar.data.length > 0) {
            avatarUrl = avatar.data[0].imageUrl;
        }
        init3DViewer(avatarUrl);

        const createdDate = new Date(profile.created).toLocaleDateString(undefined, {
            year: 'numeric', month: 'long', day: 'numeric'
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
                statusEl.textContent = userPresence.userPresenceType === 2 ? 'In Game' : 'Online';
                statusEl.className = 'online';
                lastOnlineEl.textContent = userPresence.lastLocation ? `Playing: ${userPresence.lastLocation}` : 'Active on Website';
            } else {
                statusEl.textContent = 'Offline';
                statusEl.className = 'offline';
                lastOnlineEl.textContent = userPresence.lastOnline ? new Date(userPresence.lastOnline).toLocaleString() : 'Hidden';
            }
        }

        const pastNamesContainer = document.getElementById('pastUsernames');
        if (usernameHistory.data && usernameHistory.data.length > 0) {
            pastNamesContainer.innerHTML = usernameHistory.data.map(item => `<span class="tag">${item.name}</span>`).join(' ');
        } else {
            pastNamesContainer.innerHTML = '<span class="sub-text">No recorded username changes</span>';
        }

        const groupsContainer = document.getElementById('groupsList');
        if (groups.data && groups.data.length > 0) {
            groupsContainer.innerHTML = groups.data.slice(0, 4).map(g => `<span class="tag" title="${g.role.name}">${g.group.name}</span>`).join('');
        } else {
            groupsContainer.innerHTML = '<span class="sub-text">No public groups</span>';
        }

        let totalVisits = 0;
        const gamesContainer = document.getElementById('gamesContainer');
        if (games.data && games.data.length > 0) {
            gamesContainer.innerHTML = games.data.map(game => {
                totalVisits += game.placeVisits || 0;
                return `
                    <div class="game-card">
                        <h4>${game.name}</h4>
                        <p>Visits: ${(game.placeVisits || 0).toLocaleString()}</p>
                    </div>
                `;
            }).join('');
        } else {
            gamesContainer.innerHTML = '<span class="sub-text">No public games found</span>';
        }
        document.getElementById('placeVisits').textContent = totalVisits.toLocaleString();

        loader.classList.add('hidden');
        profileContainer.classList.remove('hidden');

    } catch (err) {
        loader.classList.add('hidden');
        errorContainer.textContent = err.message || 'An error occurred while fetching user data.';
        errorContainer.classList.remove('hidden');
    }
}
