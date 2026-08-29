const usernameInput = document.getElementById('usernameInput');
const searchBtn = document.getElementById('searchBtn');
const loader = document.getElementById('loader');
const errorContainer = document.getElementById('errorContainer');
const profileContainer = document.getElementById('profileContainer');

searchBtn.addEventListener('click', performSearch);
usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch();
});

async function fetchWithCORS(url) {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl);
    if (!response.ok) throw new Error('Failed to fetch data from Roblox API.');
    return await response.json();
}

async function performSearch() {
    const username = usernameInput.value.trim();
    if (!username) return;

    // Reset UI states
    loader.classList.remove('hidden');
    errorContainer.classList.add('hidden');
    profileContainer.classList.add('hidden');

    try {
        // Step 1: Get User ID from Username
        const userLookupRes = await fetch(`https://users.roblox.com/v1/usernames/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usernames: [username], excludeBannedUsers: false })
        });
        const userData = await userLookupRes.json();

        if (!userData.data || userData.data.length === 0) {
            throw new Error('User not found!');
        }

        const userId = userData.data[0].id;
        const displayName = userData.data[0].displayName;
        const name = userData.data[0].name;

        // Step 2: Fetch parallel data (Profile, Avatar, Social Counts, Status)
        const [
            profileRes,
            avatarRes,
            followersRes,
            followingRes,
            friendsRes,
            presenceRes
        ] = await Promise.all([
            fetch(`https://users.roblox.com/v1/users/${userId}`),
            fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`),
            fetch(`https://friends.roblox.com/v1/users/${userId}/followers/count`),
            fetch(`https://friends.roblox.com/v1/users/${userId}./followings/count`).catch(() => ({count: 0})),
            fetch(`https://friends.roblox.com/v1/users/${userId}/friends/count`),
            fetch(`https://presence.roblox.com/v1/presence/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userIds: [userId] })
            })
        ]);

        const profile = await profileRes.json();
        const avatar = await avatarRes.json();
        const followers = await followersRes.json();
        const friends = await friendsRes.json();
        const presence = await presenceRes.json();

        // Step 3: Populate UI Elements
        document.getElementById('displayName').textContent = displayName;
        document.getElementById('userName').textContent = `@${name}`;
        
        if (avatar.data && avatar.data.length > 0) {
            document.getElementById('userAvatar').src = avatar.data[0].imageUrl;
        }

        // Account creation date formatting
        const createdDate = new Date(profile.created).toLocaleDateString(undefined, {
            year: 'numeric', month: 'long', day: 'numeric'
        });
        document.getElementById('createdDate').textContent = createdDate;

        document.getElementById('followersCount').textContent = followers.count?.toLocaleString() || '0';
        document.getElementById('friendsCount').textContent = friends.count?.toLocaleString() || '0';
        document.getElementById('followingCount').textContent = 'N/A'; // Endpoint restricted often

        // Place visits calculation via user creations (Public games)
        const gamesRes = await fetch(`https://games.roblox.com/v1/users/${userId}/games?limit=50`);
        const gamesData = await gamesRes.json();
        let totalVisits = 0;
        if (gamesData.data) {
            gamesData.data.forEach(game => totalVisits += game.placeVisits || 0);
        }
        document.getElementById('placeVisits').textContent = totalVisits.toLocaleString();

        // Presence / Online status handling
        const userPresence = presence.userPresences?.[0];
        const statusEl = document.getElementById('onlineStatus');
        const lastGameEl = document.getElementById('lastGame');

        if (userPresence) {
            // userType: 0=Offline, 1=Online, 2=InGame, 3=InStudio
            if (userPresence.userPresenceType > 0) {
                statusEl.textContent = userPresence.userPresenceType === 2 ? 'In Game' : 'Online';
                statusEl.className = 'online';
                if (userPresence.lastLocation) {
                    lastGameEl.textContent = userPresence.lastLocation;
                } else {
                    lastGameEl.textContent = 'Active on website / Studio';
                }
            } else {
                statusEl.textContent = 'Offline';
                statusEl.className = 'offline';
                lastGameEl.textContent = userPresence.lastOnline ? new Date(userPresence.lastOnline).toLocaleString() : 'Hidden / Unknown';
            }
        }

        loader.classList.add('hidden');
        profileContainer.classList.remove('hidden');

    } catch (err) {
        loader.classList.add('hidden');
        errorContainer.textContent = err.message || 'An error occurred while fetching user data.';
        errorContainer.classList.remove('hidden');
    }
}
