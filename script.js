// ============================================================
// ROSEARCHER
// Roblox Profile Lookup
// GitHub Pages + Cloudflare Worker
// ============================================================

const WORKER_URL =
    'https://roblox-proxy.kaydenburke.workers.dev';


// ============================================================
// DOM
// ============================================================

const usernameInput =
    document.getElementById('usernameInput');

const searchBtn =
    document.getElementById('searchBtn');

const loader =
    document.getElementById('loader');

const errorContainer =
    document.getElementById('errorContainer');

const profileContainer =
    document.getElementById('profileContainer');


// ============================================================
// STATE
// ============================================================

let currentUser = null;
let currentData = null;
let currentRequestId = 0;

let showingAllUsernames = false;
let showingAllGroups = false;
let showingAllGames = false;

let scene = null;
let camera = null;
let renderer = null;
let avatarMesh = null;

let isDragging = false;

let previousMousePosition = {
    x: 0,
    y: 0
};

let currentRotationVelocity = 0.003;
const targetRotationVelocity = 0.003;


// ============================================================
// EVENTS
// ============================================================

if (searchBtn) {
    searchBtn.addEventListener('click', performSearch);
}

if (usernameInput) {
    usernameInput.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            performSearch();
        }
    });
}


// ============================================================
// HELPERS
// ============================================================

function escapeHtml(value) {
    if (value === null || value === undefined) {
        return '';
    }

    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}


function formatNumber(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return 'N/A';
    }

    return number.toLocaleString();
}


function formatDate(value) {
    if (!value) {
        return 'N/A';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return 'N/A';
    }

    return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}


function formatDateTime(value) {
    if (!value) {
        return 'N/A';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return 'N/A';
    }

    return date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}


function getAccountAge(created) {
    if (!created) {
        return 'N/A';
    }

    const date = new Date(created);

    if (Number.isNaN(date.getTime())) {
        return 'N/A';
    }

    const now = new Date();

    let years =
        now.getFullYear() -
        date.getFullYear();

    let months =
        now.getMonth() -
        date.getMonth();

    if (months < 0) {
        years--;
        months += 12;
    }

    if (years > 0) {
        return `${years}y ${months}m`;
    }

    if (months > 0) {
        return `${months} month${months === 1 ? '' : 's'}`;
    }

    return 'Less than a month';
}


function setText(id, value) {
    const element =
        document.getElementById(id);

    if (element) {
        element.textContent =
            value === null ||
            value === undefined ||
            value === ''
                ? 'N/A'
                : value;
    }
}


function showLoading(show) {
    if (!loader) {
        return;
    }

    loader.classList.toggle(
        'hidden',
        !show
    );
}


function showProfile(show) {
    if (!profileContainer) {
        return;
    }

    profileContainer.classList.toggle(
        'hidden',
        !show
    );
}


function clearError() {
    if (!errorContainer) {
        return;
    }

    errorContainer.innerHTML = '';

    errorContainer.classList.add(
        'hidden'
    );
}


function showError(message, retry = true) {
    if (!errorContainer) {
        return;
    }

    errorContainer.innerHTML = `
        <div class="error-content">
            <span>${escapeHtml(message)}</span>

            ${
                retry
                    ? `
                        <button
                            id="retryBtn"
                            type="button"
                            class="error-retry"
                        >
                            Retry
                        </button>
                    `
                    : ''
            }
        </div>
    `;

    errorContainer.classList.remove(
        'hidden'
    );

    const retryBtn =
        document.getElementById('retryBtn');

    if (retryBtn) {
        retryBtn.addEventListener(
            'click',
            performSearch
        );
    }
}


function createElementFromHTML(html) {
    const template =
        document.createElement('template');

    template.innerHTML =
        html.trim();

    return template.content.firstElementChild;
}


// ============================================================
// WORKER FETCH
// ============================================================

async function fetchJson(
    robloxUrl,
    options = {},
    timeout = 15000
) {
    const controller =
        new AbortController();

    const timeoutId =
        setTimeout(
            () => controller.abort(),
            timeout
        );

    try {
        const proxyUrl =
            WORKER_URL +
            '/?url=' +
            encodeURIComponent(
                robloxUrl
            );

        const fetchOptions = {
            method:
                options.method || 'GET',

            signal:
                controller.signal,

            headers: {
                Accept:
                    'application/json',

                ...(options.headers || {})
            }
        };

        if (
            options.body !== undefined
        ) {
            fetchOptions.body =
                options.body;
        }

        const response =
            await fetch(
                proxyUrl,
                fetchOptions
            );

        if (!response.ok) {
            throw new Error(
                `HTTP ${response.status}`
            );
        }

        return await response.json();

    } catch (error) {

        if (
            error &&
            error.name === 'AbortError'
        ) {
            throw new Error(
                'The request timed out. Please try again.'
            );
        }

        throw error;

    } finally {
        clearTimeout(timeoutId);
    }
}


async function optionalFetch(
    url,
    options = {}
) {
    try {
        return await fetchJson(
            url,
            options
        );
    } catch (error) {
        console.warn(
            'Optional request failed:',
            url,
            error
        );

        return null;
    }
}


// ============================================================
// FIND USER
// ============================================================

async function findRobloxUser(username) {
    const url =
        'https://users.roblox.com/v1/users/search' +
        '?keyword=' +
        encodeURIComponent(username) +
        '&limit=10';

    const data =
        await fetchJson(url);

    if (
        !data ||
        !Array.isArray(data.data) ||
        data.data.length === 0
    ) {
        return null;
    }

    const exact =
        data.data.find(
            user =>
                user.name &&
                user.name.toLowerCase() ===
                username.toLowerCase()
        );

    return exact || data.data[0];
}


// ============================================================
// PROFILE DATA
// ============================================================

async function fetchProfileData(userId) {
    const urls = {
        profile:
            `https://users.roblox.com/v1/users/${userId}`,

        avatar:
            `https://thumbnails.roblox.com/v1/users/avatar` +
            `?userIds=${userId}` +
            `&size=720x720` +
            `&format=Png` +
            `&isCircular=false`,

        headshot:
            `https://thumbnails.roblox.com/v1/users/avatar-headshot` +
            `?userIds=${userId}` +
            `&size=420x420` +
            `&format=Png` +
            `&isCircular=false`,

        followers:
            `https://friends.roblox.com/v1/users/${userId}/followers/count`,

        friends:
            `https://friends.roblox.com/v1/users/${userId}/friends/count`,

        following:
            `https://friends.roblox.com/v1/users/${userId}/followings/count`,

        usernameHistory:
            `https://users.roblox.com/v1/users/${userId}/username-history`,

        groups:
            `https://groups.roblox.com/v1/users/${userId}/groups/roles`,

        games:
            `https://games.roblox.com/v2/users/${userId}/games` +
            `?accessFilter=Public` +
            `&sortOrder=Desc` +
            `&limit=50`,

        avatarRig:
            `https://avatar.roblox.com/v2/avatar/users/${userId}/avatar`,

        presence:
            `https://presence.roblox.com/v1/presence/users`,

        badges:
            `https://badges.roblox.com/v1/users/${userId}/badges` +
            `?limit=100&sortOrder=Desc`
    };

    const results =
        await Promise.allSettled([
            optionalFetch(urls.profile),
            optionalFetch(urls.avatar),
            optionalFetch(urls.headshot),
            optionalFetch(urls.followers),
            optionalFetch(urls.friends),
            optionalFetch(urls.following),
            optionalFetch(urls.usernameHistory),
            optionalFetch(urls.groups),
            optionalFetch(urls.games),
            optionalFetch(urls.avatarRig),
            optionalFetch(urls.badges),

            optionalFetch(
                urls.presence,
                {
                    method: 'POST',

                    headers: {
                        'Content-Type':
                            'application/json'
                    },

                    body:
                        JSON.stringify({
                            userIds: [
                                Number(userId)
                            ]
                        })
                }
            )
        ]);

    function resultAt(index) {
        const result =
            results[index];

        if (
            result &&
            result.status === 'fulfilled'
        ) {
            return result.value;
        }

        return null;
    }

    return {
        profile:
            resultAt(0),

        avatar:
            resultAt(1),

        headshot:
            resultAt(2),

        followers:
            resultAt(3),

        friends:
            resultAt(4),

        following:
            resultAt(5),

        usernameHistory:
            resultAt(6),

        groups:
            resultAt(7),

        games:
            resultAt(8),

        avatarRig:
            resultAt(9),

        badges:
            resultAt(10),

        presence:
            resultAt(11)
    };
}


// ============================================================
// PROFILE LINKS
// ============================================================

function profileUrl(userId) {
    return `https://www.roblox.com/users/${userId}/profile`;
}


function groupUrl(groupId) {
    return `https://www.roblox.com/groups/${groupId}`;
}


function gameUrl(placeId) {
    return `https://www.roblox.com/games/${placeId}`;
}


// ============================================================
// IDENTITY
// ============================================================

function updateIdentity(user, profile) {
    const username =
        profile?.name ||
        user?.name ||
        'Unknown';

    const displayName =
        profile?.displayName ||
        user?.displayName ||
        username;

    setText(
        'displayName',
        displayName
    );

    setText(
        'userName',
        `@${username}`
    );

    setText(
        'userId',
        user?.id
    );

    const badge =
        document.getElementById(
            'verifiedBadge'
        );

    if (badge) {
        badge.classList.toggle(
            'hidden',
            !profile?.hasVerifiedBadge
        );
    }

    const profileLink =
        document.getElementById(
            'profileLink'
        );

    if (profileLink) {
        profileLink.href =
            profileUrl(user.id);

        profileLink.target =
            '_blank';

        profileLink.rel =
            'noopener noreferrer';
    }

    const usernameLink =
        document.getElementById(
            'usernameProfileLink'
        );

    if (usernameLink) {
        usernameLink.href =
            profileUrl(user.id);

        usernameLink.target =
            '_blank';

        usernameLink.rel =
            'noopener noreferrer';
    }
}


// ============================================================
// AVATAR
// ============================================================

function updateAvatar(data) {
    let avatarUrl = '';

    if (
        data.avatar &&
        Array.isArray(data.avatar.data) &&
        data.avatar.data[0]?.imageUrl
    ) {
        avatarUrl =
            data.avatar.data[0].imageUrl;
    }

    if (
        !avatarUrl &&
        data.headshot &&
        Array.isArray(data.headshot.data) &&
        data.headshot.data[0]?.imageUrl
    ) {
        avatarUrl =
            data.headshot.data[0].imageUrl;
    }

    if (avatarUrl) {
        init3DViewer(
            avatarUrl
        );
    } else {
        showAvatarFallback();
    }

    const avatarImage =
        document.getElementById(
            'avatarImage'
        );

    if (
        avatarImage &&
        avatarUrl
    ) {
        avatarImage.src =
            avatarUrl;

        avatarImage.alt =
            'Roblox avatar';
    }
}


function showAvatarFallback() {
    const container =
        document.getElementById(
            'canvasContainer'
        );

    if (!container) {
        return;
    }

    container.innerHTML = `
        <div class="avatar-fallback">
            ?
        </div>
    `;
}


// ============================================================
// 3D VIEWER
// ============================================================

function init3DViewer(imageUrl) {
    const container =
        document.getElementById(
            'canvasContainer'
        );

    if (!container) {
        return;
    }

    container.innerHTML = '';

    if (!window.THREE) {
        showAvatarFallback();
        return;
    }

    if (renderer) {
        try {
            renderer.dispose();
        } catch (_) {}
    }

    scene =
        new THREE.Scene();

    camera =
        new THREE.PerspectiveCamera(
            35,
            1,
            0.1,
            100
        );

    camera.position.z =
        3.2;

    renderer =
        new THREE.WebGLRenderer({
            antialias: true,
            alpha: true
        });

    renderer.setSize(
        260,
        260,
        false
    );

    renderer.setPixelRatio(
        Math.min(
            window.devicePixelRatio || 1,
            2
        )
    );

    container.appendChild(
        renderer.domElement
    );

    const textureLoader =
        new THREE.TextureLoader();

    textureLoader.crossOrigin =
        'anonymous';

    textureLoader.load(
        imageUrl,

        function (texture) {
            const geometry =
                new THREE.PlaneGeometry(
                    2.5,
                    2.5
                );

            const material =
                new THREE.MeshBasicMaterial({
                    map: texture,
                    transparent: true,
                    side: THREE.DoubleSide
                });

            avatarMesh =
                new THREE.Mesh(
                    geometry,
                    material
                );

            scene.add(
                avatarMesh
            );

            currentRotationVelocity =
                targetRotationVelocity;

            animate3D();
        },

        undefined,

        function () {
            showAvatarFallback();
        }
    );

    container.addEventListener(
        'pointerdown',
        function (event) {
            isDragging = true;

            previousMousePosition = {
                x: event.clientX,
                y: event.clientY
            };

            container.setPointerCapture?.(
                event.pointerId
            );
        }
    );

    container.addEventListener(
        'pointerup',
        function () {
            isDragging = false;
        }
    );

    container.addEventListener(
        'pointerleave',
        function () {
            isDragging = false;
        }
    );
}


window.addEventListener(
    'pointermove',
    function (event) {
        if (
            !isDragging ||
            !avatarMesh
        ) {
            return;
        }

        const deltaX =
            event.clientX -
            previousMousePosition.x;

        const deltaY =
            event.clientY -
            previousMousePosition.y;

        avatarMesh.rotation.y +=
            deltaX * 0.01;

        avatarMesh.rotation.x +=
            deltaY * 0.006;

        currentRotationVelocity =
            deltaX * 0.0005;

        previousMousePosition = {
            x: event.clientX,
            y: event.clientY
        };
    }
);


function animate3D() {
    if (
        !renderer ||
        !scene ||
        !camera
    ) {
        return;
    }

    requestAnimationFrame(
        animate3D
    );

    if (
        avatarMesh &&
        !isDragging
    ) {
        currentRotationVelocity +=
            (
                targetRotationVelocity -
                currentRotationVelocity
            ) * 0.05;

        avatarMesh.rotation.y +=
            currentRotationVelocity;

        avatarMesh.rotation.x *=
            0.96;
    }

    renderer.render(
        scene,
        camera
    );
}


// ============================================================
// STATS
// ============================================================

function updateStats(data) {
    const created =
        data.profile?.created;

    setText(
        'createdDate',
        formatDate(created)
    );

    setText(
        'accountAge',
        getAccountAge(created)
    );

    setText(
        'followersCount',
        data.followers?.count !== undefined
            ? formatNumber(
                data.followers.count
            )
            : 'N/A'
    );

    setText(
        'friendsCount',
        data.friends?.count !== undefined
            ? formatNumber(
                data.friends.count
            )
            : 'N/A'
    );

    setText(
        'followingCount',
        data.following?.count !== undefined
            ? formatNumber(
                data.following.count
            )
            : 'N/A'
    );

    setText(
        'rigType',
        data.avatarRig?.playerAvatarType ||
        'N/A'
    );

    setText(
        'description',
        data.profile?.description ||
        'No description'
    );

    setText(
        'isBanned',
        data.profile?.isBanned
            ? 'Yes'
            : 'No'
    );

    setText(
        'hasVerifiedBadge',
        data.profile?.hasVerifiedBadge
            ? 'Yes'
            : 'No'
    );

    setText(
        'joinDate',
        formatDateTime(created)
    );
}


// ============================================================
// PRESENCE
// ============================================================

function updatePresence(data) {
    const status =
        document.getElementById(
            'onlineStatus'
        );

    const lastOnline =
        document.getElementById(
            'lastOnline'
        );

    const location =
        document.getElementById(
            'lastLocation'
        );

    if (!status) {
        return;
    }

    const presence =
        data?.userPresences?.[0] ||
        data?.presence?.userPresences?.[0];

    if (!presence) {
        status.textContent =
            'UNKNOWN';

        status.className =
            'status-pill';

        if (lastOnline) {
            lastOnline.textContent =
                'Unavailable';
        }

        if (location) {
            location.textContent =
                'N/A';
        }

        return;
    }

    const type =
        Number(
            presence.userPresenceType
        );

    let text = 'OFFLINE';

    if (type === 1) {
        text = 'ONLINE';
    }

    if (type === 2) {
        text = 'IN GAME';
    }

    if (type === 3) {
        text = 'IN STUDIO';
    }

    status.textContent =
        text;

    status.className =
        type === 0
            ? 'status-pill'
            : 'status-pill online';

    if (location) {
        location.textContent =
            presence.lastLocation ||
            (
                type === 0
                    ? 'Offline'
                    : 'Active'
            );
    }

    if (lastOnline) {
        if (
            presence.lastOnline
        ) {
            lastOnline.textContent =
                formatDateTime(
                    presence.lastOnline
                );
        } else if (
            presence.lastOnlineTime
        ) {
            lastOnline.textContent =
                formatDateTime(
                    presence.lastOnlineTime
                );
        } else {
            lastOnline.textContent =
                type === 0
                    ? 'Not provided by Roblox'
                    : 'Currently active';
        }
    }
}


// ============================================================
// USERNAME HISTORY
// ============================================================

function updateUsernameHistory(history) {
    const container =
        document.getElementById(
            'pastUsernames'
        );

    if (!container) {
        return;
    }

    const items =
        Array.isArray(history?.data)
            ? history.data
            : [];

    if (!items.length) {
        container.innerHTML =
            '<span class="empty-hint">No previous usernames found</span>';

        return;
    }

    const visible =
        showingAllUsernames
            ? items
            : items.slice(0, 6);

    container.innerHTML =
        visible
            .map(item => `
                <span class="tag">
                    ${escapeHtml(item.name)}
                </span>
            `)
            .join('');

    if (items.length > 6) {
        container.innerHTML += `
            <button
                type="button"
                class="show-all-btn"
                id="showAllUsernames"
            >
                ${
                    showingAllUsernames
                        ? 'Show Less'
                        : `Show All (${items.length})`
                }
            </button>
        `;

        const button =
            document.getElementById(
                'showAllUsernames'
            );

        if (button) {
            button.addEventListener(
                'click',
                function () {
                    showingAllUsernames =
                        !showingAllUsernames;

                    updateUsernameHistory(
                        history
                    );
                }
            );
        }
    }
}


// ============================================================
// GROUPS
// ============================================================

function updateGroups(groups) {
    const container =
        document.getElementById(
            'groupsList'
        );

    if (!container) {
        return;
    }

    const items =
        Array.isArray(groups?.data)
            ? groups.data
            : [];

    if (!items.length) {
        container.innerHTML =
            '<span class="empty-hint">No public groups found</span>';

        return;
    }

    const visible =
        showingAllGroups
            ? items
            : items.slice(0, 6);

    container.innerHTML =
        visible
            .map(groupData => {
                const group =
                    groupData?.group;

                const role =
                    groupData?.role;

                if (!group?.id) {
                    return '';
                }

                return `
                    <a
                        class="group-item"
                        href="${groupUrl(group.id)}"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <div class="group-item-main">
                            <strong>
                                ${escapeHtml(
                                    group.name ||
                                    'Unknown group'
                                )}
                            </strong>

                            <span>
                                ${escapeHtml(
                                    role?.name ||
                                    'Member'
                                )}
                            </span>
                        </div>

                        <span class="external-arrow">
                            ↗
                        </span>
                    </a>
                `;
            })
            .join('');

    if (items.length > 6) {
        container.innerHTML += `
            <button
                type="button"
                class="show-all-btn"
                id="showAllGroups"
            >
                ${
                    showingAllGroups
                        ? 'Show Less'
                        : `Show All (${items.length})`
                }
            </button>
        `;

        const button =
            document.getElementById(
                'showAllGroups'
            );

        if (button) {
            button.addEventListener(
                'click',
                function () {
                    showingAllGroups =
                        !showingAllGroups;

                    updateGroups(
                        groups
                    );
                }
            );
        }
    }
}


// ============================================================
// EXPERIENCES
// ============================================================

function updateGames(games) {
    const container =
        document.getElementById(
            'gamesContainer'
        );

    const visitsElement =
        document.getElementById(
            'placeVisits'
        );

    if (!container) {
        return;
    }

    const items =
        Array.isArray(games?.data)
            ? games.data
            : [];

    if (!items.length) {
        container.innerHTML =
            '<span class="empty-hint">No public experiences found</span>';

        if (visitsElement) {
            visitsElement.textContent =
                'N/A';
        }

        return;
    }

    const visible =
        showingAllGames
            ? items
            : items.slice(0, 6);

    let totalVisits = 0;

    items.forEach(game => {
        totalVisits +=
            Number(
                game?.placeVisits
            ) || 0;
    });

    container.innerHTML =
        visible
            .map(game => {
                const id =
                    game?.id ||
                    game?.rootPlace?.id;

                const name =
                    game?.name ||
                    'Unnamed experience';

                const visits =
                    Number(
                        game?.placeVisits
                    ) || 0;

                const description =
                    game?.description ||
                    'No description available.';

                const url =
                    id
                        ? gameUrl(id)
                        : '#';

                return `
                    <a
                        class="exp-card"
                        href="${url}"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <div class="exp-card-content">
                            <h4>
                                ${escapeHtml(name)}
                            </h4>

                            <p>
                                ${escapeHtml(
                                    description
                                )}
                            </p>

                            <div class="exp-meta">
                                <span>
                                    Visits:
                                    ${formatNumber(visits)}
                                </span>

                                ${
                                    id
                                        ? `<span>ID: ${escapeHtml(id)}</span>`
                                        : ''
                                }
                            </div>
                        </div>

                        <span class="external-arrow">
                            ↗
                        </span>
                    </a>
                `;
            })
            .join('');

    if (visitsElement) {
        visitsElement.textContent =
            formatNumber(
                totalVisits
            );
    }

    if (items.length > 6) {
        container.innerHTML += `
            <button
                type="button"
                class="show-all-btn"
                id="showAllGames"
            >
                ${
                    showingAllGames
                        ? 'Show Less'
                        : `Show All (${items.length})`
                }
            </button>
        `;

        const button =
            document.getElementById(
                'showAllGames'
            );

        if (button) {
            button.addEventListener(
                'click',
                function (event) {
                    event.preventDefault();

                    showingAllGames =
                        !showingAllGames;

                    updateGames(
                        games
                    );
                }
            );
        }
    }
}


// ============================================================
// BADGES
// ============================================================

function updateBadges(badges) {
    const container =
        document.getElementById(
            'badgesContainer'
        );

    if (!container) {
        return;
    }

    const items =
        Array.isArray(badges?.data)
            ? badges.data
            : [];

    if (!items.length) {
        container.innerHTML =
            '<span class="empty-hint">No badges available</span>';

        return;
    }

    container.innerHTML =
        items
            .slice(0, 12)
            .map(badge => `
                <div class="badge-item">
                    <strong>
                        ${escapeHtml(
                            badge.name ||
                            'Badge'
                        )}
                    </strong>

                    <span>
                        ${escapeHtml(
                            badge.description ||
                            ''
                        )}
                    </span>
                </div>
            `)
            .join('');
}


// ============================================================
// COPY USER ID
// ============================================================

async function copyUserId() {
    if (!currentUser?.id) {
        return;
    }

    try {
        await navigator.clipboard.writeText(
            String(currentUser.id)
        );

        const button =
            document.getElementById(
                'copyUserId'
            );

        if (button) {
            const original =
                button.textContent;

            button.textContent =
                'Copied!';

            setTimeout(
                () => {
                    button.textContent =
                        original;
                },
                1500
            );
        }

    } catch (error) {
        console.warn(
            'Could not copy User ID:',
            error
        );
    }
}


// ============================================================
// SHARE
// ============================================================

async function shareProfile() {
    if (!currentUser?.name) {
        return;
    }

    const url =
        profileUrl(
            currentUser.id
        );

    try {
        if (
            navigator.share
        ) {
            await navigator.share({
                title:
                    `${currentUser.name} - RoSearcher`,

                text:
                    `Roblox profile for @${currentUser.name}`,

                url
            });

            return;
        }

        await navigator.clipboard.writeText(
            url
        );

        const button =
            document.getElementById(
                'shareProfile'
            );

        if (button) {
            const original =
                button.textContent;

            button.textContent =
                'Link Copied!';

            setTimeout(
                () => {
                    button.textContent =
                        original;
                },
                1500
            );
        }

    } catch (error) {
        console.warn(
            'Share failed:',
            error
        );
    }
}


// ============================================================
// BIND ACTION BUTTONS
// ============================================================

function bindActionButtons() {
    const copyButton =
        document.getElementById(
            'copyUserId'
        );

    if (copyButton) {
        copyButton.onclick =
            copyUserId;
    }

    const shareButton =
        document.getElementById(
            'shareProfile'
        );

    if (shareButton) {
        shareButton.onclick =
            shareProfile;
    }
}


// ============================================================
// SETTINGS
// ============================================================

function initSettings() {
    const settingsButton =
        document.getElementById(
            'settingsBtn'
        );

    const settingsPanel =
        document.getElementById(
            'settingsPanel'
        );

    const closeSettings =
        document.getElementById(
            'closeSettings'
        );

    if (
        settingsButton &&
        settingsPanel
    ) {
        settingsButton.addEventListener(
            'click',
            function () {
                settingsPanel.classList.toggle(
                    'hidden'
                );
            }
        );
    }

    if (
        closeSettings &&
        settingsPanel
    ) {
        closeSettings.addEventListener(
            'click',
            function () {
                settingsPanel.classList.add(
                    'hidden'
                );
            }
        );
    }

    const themeSelect =
        document.getElementById(
            'themeSelect'
        );

    if (themeSelect) {
        const saved =
            localStorage.getItem(
                'rosearcher-theme'
            );

        if (saved) {
            themeSelect.value =
                saved;

            document.documentElement.dataset.theme =
                saved;
        }

        themeSelect.addEventListener(
            'change',
            function () {
                const value =
                    themeSelect.value;

                document.documentElement.dataset.theme =
                    value;

                localStorage.setItem(
                    'rosearcher-theme',
                    value
                );
            }
        );
    }
}


// ============================================================
// SEARCH
// ============================================================

async function performSearch() {
    if (!usernameInput) {
        return;
    }

    const username =
        usernameInput.value.trim();

    if (!username) {
        showError(
            'Enter a Roblox username first.',
            false
        );

        return;
    }

    const requestId =
        ++currentRequestId;

    showingAllUsernames = false;
    showingAllGroups = false;
    showingAllGames = false;

    clearError();
    showLoading(true);
    showProfile(false);

    if (searchBtn) {
        searchBtn.disabled =
            true;

        searchBtn.classList.add(
            'loading'
        );
    }

    try {
        const user =
            await findRobloxUser(
                username
            );

        if (
            requestId !==
            currentRequestId
        ) {
            return;
        }

        if (!user) {
            throw new Error(
                `No Roblox user named "${username}" was found.`
            );
        }

        currentUser =
            user;

        const data =
            await fetchProfileData(
                user.id
            );

        if (
            requestId !==
            currentRequestId
        ) {
            return;
        }

        currentData =
            data;

        updateIdentity(
            user,
            data.profile
        );

        updateAvatar(
            data
        );

        updateStats(
            data
        );

        updatePresence(
            data.presence
        );

        updateUsernameHistory(
            data.usernameHistory
        );

        updateGroups(
            data.groups
        );

        updateGames(
            data.games
        );

        updateBadges(
            data.badges
        );

        bindActionButtons();

        showProfile(true);

        updateUrl(
            username
        );

    } catch (error) {
        console.error(
            'RoSearcher error:',
            error
        );

        if (
            requestId !==
            currentRequestId
        ) {
            return;
        }

        showError(
            error?.message ||
            'Something went wrong while searching Roblox.'
        );

    } finally {
        if (
            requestId ===
            currentRequestId
        ) {
            showLoading(false);

            if (searchBtn) {
                searchBtn.disabled =
                    false;

                searchBtn.classList.remove(
                    'loading'
                );
            }
        }
    }
}


// ============================================================
// URL
// ============================================================

function updateUrl(username) {
    try {
        const url =
            new URL(
                window.location.href
            );

        url.searchParams.set(
            'user',
            username
        );

        window.history.replaceState(
            {},
            '',
            url
        );

    } catch (error) {
        console.warn(
            'Could not update URL:',
            error
        );
    }
}


function loadUsernameFromUrl() {
    try {
        const params =
            new URLSearchParams(
                window.location.search
            );

        const username =
            params.get('user');

        if (
            username &&
            usernameInput
        ) {
            usernameInput.value =
                username;

            performSearch();
        }

    } catch (error) {
        console.warn(
            'Could not read URL:',
            error
        );
    }
}


// ============================================================
// STARTUP
// ============================================================

document.addEventListener(
    'DOMContentLoaded',
    function () {
        initSettings();
        bindActionButtons();
        loadUsernameFromUrl();
    }
);

