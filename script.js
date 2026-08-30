const WORKER_URL = "https://roblox-proxy.kaydenburke.workers.dev";

const usernameInput = document.getElementById("usernameInput");
const searchBtn = document.getElementById("searchBtn");
const loader = document.getElementById("loader");
const errorContainer = document.getElementById("errorContainer");
const profileContainer = document.getElementById("profileContainer");

let requestNumber = 0;


// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------

function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent =
            value === null || value === undefined
                ? "N/A"
                : value;
    }
}


function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function formatNumber(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return "N/A";
    }

    return number.toLocaleString();
}


function formatDate(value) {
    if (!value) {
        return "N/A";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "N/A";
    }

    return date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric"
    });
}


function setLoading(isLoading) {
    if (loader) {
        loader.classList.toggle("hidden", !isLoading);
    }

    if (searchBtn) {
        searchBtn.disabled = isLoading;
    }
}


function hideError() {
    if (!errorContainer) {
        return;
    }

    errorContainer.textContent = "";
    errorContainer.classList.add("hidden");
}


function showError(message) {
    if (!errorContainer) {
        return;
    }

    errorContainer.textContent = message;
    errorContainer.classList.remove("hidden");
}


// ------------------------------------------------------------
// ROBLOX REQUEST THROUGH WORKER
// ------------------------------------------------------------

async function robloxRequest(endpoint, options = {}) {

    const url =
        WORKER_URL +
        "?url=" +
        encodeURIComponent(endpoint);

    const response = await fetch(url, {
        method: options.method || "GET",
        headers: {
            "Accept": "application/json",
            ...(options.headers || {})
        },
        body: options.body
    });

    if (!response.ok) {
        throw new Error(
            "Worker returned HTTP " + response.status
        );
    }

    const text = await response.text();

    if (!text) {
        throw new Error("The Worker returned an empty response.");
    }

    try {
        return JSON.parse(text);
    } catch {
        console.error("Worker response:", text);

        throw new Error(
            "The Worker did not return valid JSON."
        );
    }
}


// ------------------------------------------------------------
// FIND USER
// ------------------------------------------------------------

async function findUser(username) {

    const endpoint =
        "https://users.roblox.com/v1/users/search" +
        "?keyword=" +
        encodeURIComponent(username) +
        "&limit=10";

    const data = await robloxRequest(endpoint);

    if (!data || !Array.isArray(data.data)) {
        throw new Error("Invalid Roblox search response.");
    }

    const exact = data.data.find(user =>
        user.name &&
        user.name.toLowerCase() === username.toLowerCase()
    );

    return exact || data.data[0] || null;
}


// ------------------------------------------------------------
// LOAD PROFILE
// ------------------------------------------------------------

async function loadProfile(userId) {

    const profile = await robloxRequest(
        "https://users.roblox.com/v1/users/" + userId
    );

    const avatar = await robloxRequest(
        "https://thumbnails.roblox.com/v1/users/avatar-headshot" +
        "?userIds=" + userId +
        "&size=420x420" +
        "&format=Png" +
        "&isCircular=false"
    );

    let followers = null;
    let friends = null;
    let history = null;
    let avatarData = null;
    let groups = null;
    let games = null;
    let presence = null;

    try {
        followers = await robloxRequest(
            "https://friends.roblox.com/v1/users/" +
            userId +
            "/followers/count"
        );
    } catch (error) {
        console.warn("Followers unavailable:", error);
    }

    try {
        friends = await robloxRequest(
            "https://friends.roblox.com/v1/users/" +
            userId +
            "/friends/count"
        );
    } catch (error) {
        console.warn("Friends unavailable:", error);
    }

    try {
        history = await robloxRequest(
            "https://users.roblox.com/v1/users/" +
            userId +
            "/username-history"
        );
    } catch (error) {
        console.warn("Username history unavailable:", error);
    }

    try {
        avatarData = await robloxRequest(
            "https://avatar.roblox.com/v2/avatar/users/" +
            userId +
            "/avatar"
        );
    } catch (error) {
        console.warn("Avatar data unavailable:", error);
    }

    try {
        groups = await robloxRequest(
            "https://groups.roblox.com/v1/users/" +
            userId +
            "/groups/roles"
        );
    } catch (error) {
        console.warn("Groups unavailable:", error);
    }

    try {
        games = await robloxRequest(
            "https://games.roblox.com/v1/users/" +
            userId +
            "/games?limit=6"
        );
    } catch (error) {
        console.warn("Games unavailable:", error);
    }

    try {
        presence = await robloxRequest(
            "https://presence.roblox.com/v1/presence/users",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    userIds: [Number(userId)]
                })
            }
        );
    } catch (error) {
        console.warn("Presence unavailable:", error);
    }

    return {
        profile,
        avatar,
        followers,
        friends,
        history,
        avatarData,
        groups,
        games,
        presence
    };
}


// ------------------------------------------------------------
// UPDATE PROFILE
// ------------------------------------------------------------

function updateProfile(user, data) {

    const profile = data.profile;

    setText(
        "displayName",
        profile?.displayName || user.name
    );

    setText(
        "userName",
        "@" + (profile?.name || user.name)
    );

    const verified =
        document.getElementById("verifiedBadge");

    if (verified) {
        verified.classList.toggle(
            "hidden",
            !profile?.hasVerifiedBadge
        );
    }

    setText(
        "createdDate",
        formatDate(profile?.created)
    );

    setText(
        "followersCount",
        data.followers?.count !== undefined
            ? formatNumber(data.followers.count)
            : "N/A"
    );

    setText(
        "friendsCount",
        data.friends?.count !== undefined
            ? formatNumber(data.friends.count)
            : "N/A"
    );

    setText(
        "rigType",
        data.avatarData?.playerAvatarType || "N/A"
    );

    updateAvatar(data.avatar);
    updatePresence(data.presence);
    updateHistory(data.history);
    updateGroups(data.groups);
    updateGames(data.games);
}


// ------------------------------------------------------------
// AVATAR
// ------------------------------------------------------------

function updateAvatar(avatar) {

    const container =
        document.getElementById("canvasContainer");

    if (!container) {
        return;
    }

    const imageUrl =
        avatar?.data?.[0]?.imageUrl;

    if (!imageUrl) {
        container.innerHTML =
            "<span>Avatar unavailable</span>";
        return;
    }

    container.innerHTML = `
        <img
            src="${escapeHtml(imageUrl)}"
            alt="Roblox avatar"
            style="
                width:100%;
                height:100%;
                object-fit:contain;
                display:block;
            "
        >
    `;
}


// ------------------------------------------------------------
// PRESENCE
// ------------------------------------------------------------

function updatePresence(data) {

    const status =
        document.getElementById("onlineStatus");

    const location =
        document.getElementById("lastOnline");

    if (!status) {
        return;
    }

    const presence =
        data?.userPresences?.[0];

    if (!presence) {
        status.textContent = "UNKNOWN";
        status.className = "status-pill";

        if (location) {
            location.textContent = "Unavailable";
        }

        return;
    }

    const type =
        Number(presence.userPresenceType);

    let text = "OFFLINE";

    if (type === 1) {
        text = "ONLINE";
    }

    if (type === 2) {
        text = "IN GAME";
    }

    if (type === 3) {
        text = "IN STUDIO";
    }

    status.textContent = text;

    status.className =
        type === 0
            ? "status-pill"
            : "status-pill online";

    if (location) {
        location.textContent =
            presence.lastLocation ||
            (type === 0 ? "Currently offline" : "Active");
    }
}


// ------------------------------------------------------------
// USERNAME HISTORY
// ------------------------------------------------------------

function updateHistory(data) {

    const container =
        document.getElementById("pastUsernames");

    if (!container) {
        return;
    }

    if (
        !data ||
        !Array.isArray(data.data) ||
        data.data.length === 0
    ) {
        container.innerHTML =
            '<span class="empty-hint">No past aliases</span>';

        return;
    }

    container.innerHTML =
        data.data.map(item => `
            <span class="tag">
                ${escapeHtml(item.name)}
            </span>
        `).join("");
}


// ------------------------------------------------------------
// GROUPS
// ------------------------------------------------------------

function updateGroups(data) {

    const container =
        document.getElementById("groupsList");

    if (!container) {
        return;
    }

    if (
        !data ||
        !Array.isArray(data.data) ||
        data.data.length === 0
    ) {
        container.innerHTML =
            '<span class="empty-hint">No public organizations</span>';

        return;
    }

    container.innerHTML =
        data.data.slice(0, 4).map(item => {

            const name =
                item?.group?.name || "Unknown group";

            const role =
                item?.role?.name || "Unknown role";

            return `
                <span
                    class="tag"
                    title="${escapeHtml(role)}"
                >
                    ${escapeHtml(name)}
                </span>
            `;
        }).join("");
}


// ------------------------------------------------------------
// GAMES
// ------------------------------------------------------------

function updateGames(data) {

    const container =
        document.getElementById("gamesContainer");

    const visits =
        document.getElementById("placeVisits");

    if (!container) {
        return;
    }

    if (
        !data ||
        !Array.isArray(data.data) ||
        data.data.length === 0
    ) {
        container.innerHTML =
            '<span class="empty-hint">No public experiences found</span>';

        if (visits) {
            visits.textContent = "N/A";
        }

        return;
    }

    let total = 0;

    container.innerHTML =
        data.data.map(game => {

            const name =
                game?.name || "Unnamed experience";

            const count =
                Number(game?.placeVisits) || 0;

            total += count;

            return `
                <div class="exp-card">
                    <h4>${escapeHtml(name)}</h4>
                    <p>Visits: ${formatNumber(count)}</p>
                </div>
            `;
        }).join("");

    if (visits) {
        visits.textContent =
            formatNumber(total);
    }
}


// ------------------------------------------------------------
// SEARCH
// ------------------------------------------------------------

async function performSearch() {

    const username =
        usernameInput?.value?.trim();

    if (!username) {
        showError("Enter a Roblox username first.");
        return;
    }

    const id = ++requestNumber;

    hideError();
    setLoading(true);

    if (profileContainer) {
        profileContainer.classList.add("hidden");
    }

    try {

        const user =
            await findUser(username);

        if (id !== requestNumber) {
            return;
        }

        if (!user) {
            throw new Error(
                'No Roblox user named "' +
                username +
                '" was found.'
            );
        }

        const data =
            await loadProfile(user.id);

        if (id !== requestNumber) {
            return;
        }

        updateProfile(user, data);

        if (profileContainer) {
            profileContainer.classList.remove("hidden");
        }

    } catch (error) {

        console.error(error);

        if (id === requestNumber) {
            showError(
                error.message ||
                "Something went wrong."
            );
        }

    } finally {

        if (id === requestNumber) {
            setLoading(false);
        }
    }
}


// ------------------------------------------------------------
// EVENTS
// ------------------------------------------------------------

if (searchBtn) {
    searchBtn.addEventListener(
        "click",
        performSearch
    );
}

if (usernameInput) {
    usernameInput.addEventListener(
        "keydown",
        event => {
            if (event.key === "Enter") {
                performSearch();
            }
        }
    );
}


// ------------------------------------------------------------
// URL SEARCH
// ------------------------------------------------------------

const params =
    new URLSearchParams(window.location.search);

const startingUsername =
    params.get("user");

if (startingUsername && usernameInput) {
    usernameInput.value = startingUsername;
    performSearch();
}

