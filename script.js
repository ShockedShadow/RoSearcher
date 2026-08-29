const usernameInput = document.getElementById('usernameInput');
const searchBtn = document.getElementById('searchBtn');
const loader = document.getElementById('loader');
const errorContainer = document.getElementById('errorContainer');
const profileContainer = document.getElementById('profileContainer');

searchBtn.addEventListener('click', performSearch);
usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch();
});

async function performSearch() {
    const username = usernameInput.value.trim();
    if (!username) return;

    loader.classList.remove('hidden');
    errorContainer.classList.add('hidden');
    profileContainer.classList.add('hidden');

    try {
        // Step 1: User ID Lookup
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

        // Step 2: Fetch extended data in parallel
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
            fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`),
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

        // --- Render Core Information ---
        document.getElementById('displayName').textContent = displayName;
        document.getElementById('userName').textContent = `@${name}`;

        // Verified Badge handling
        const badgeEl = document.getElementById('verifiedBadge');
        if (profile.hasVerifiedBadge) {
            badgeEl.classList.remove('hidden');
        } else {
            badgeEl.classList.add('hidden');
        }

        if (avatar.data && avatar.data.length > 0) {
            document.getElementById('userAvatar').src = avatar.data[0].imageUrl;
        }

        // Account creation date
        const createdDate = new Date(profile.created).toLocaleDateString(undefined, {
            year: 'numeric', month: 'long', day: 'numeric'
        });
        document.getElementById('createdDate').textContent = createdDate;

        document.getElementById('followersCount').textContent = followers.count?.toLocaleString() || '0';
        document.getElementById('friendsCount').textContent = friends.count?.toLocaleString() || '0';

        // Rig Type (R6 / R15)
        document.getElementById('rigType').textContent = avatarRig.playerAvatarType || 'Unknown';

        // --- Render Presence & Status ---
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

        // --- Render Previous Usernames ---
        const pastNamesContainer = document.getElementById('pastUsernames');
        if (usernameHistory.data && usernameHistory.data.length > 0) {
            pastNamesContainer.innerHTML = usernameHistory.data.map(item => `<span class="tag">${item.name}</span>`).join(' ');
        } else {
            pastNamesContainer.innerHTML = '<span class="sub-text">No recorded username changes</span>';
        }

        // --- Render Groups ---
        const groupsContainer = document.getElementById('groupsList');
        if (groups.data && groups.data.length > 0) {
            groupsContainer.innerHTML = groups.data.slice(0, 5).map(g => `<span class="tag" title="${g.role.name}">${g.group.name}</span>`).join('');
        } else {
            groupsContainer.innerHTML = '<span class="sub-text">No public groups</span>';
        }

        // --- Render Place Visits & Games ---
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
