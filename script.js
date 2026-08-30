// ============================================================
// ROBLOX PROFILE LOOKUP
// GitHub Pages + Cloudflare Worker
// ============================================================

const CLOUDFLARE_WORKER =
    'https://roblox-proxy.kaydenburke.workers.dev';


// ============================================================
// DOM ELEMENTS
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

let scene = null;
let camera = null;
let renderer = null;
let avatarMesh = null;

let isDragging = false;

let previousMousePosition = {
    x: 0,
    y: 0
};

let targetRotationVelocity = 0.003;
let currentRotationVelocity = 0.003;

let currentRequestId = 0;


// ============================================================
// EVENT LISTENERS
// ============================================================

if (searchBtn) {
    searchBtn.addEventListener(
        'click',
        performSearch
    );
}

if (usernameInput) {
    usernameInput.addEventListener(
        'keypress',
        function (event) {
            if (event.key === 'Enter') {
                performSearch();
            }
        }
    );
}


// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function escapeHtml(value) {
    if (
        value === null ||
        value === undefined
    ) {
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

    return date.toLocaleDateString(
        undefined,
        {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        }
    );
}


function setText(id, value) {
    const element =
        document.getElementById(id);

    if (element) {
        element.textContent =
            value ?? 'N/A';
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


function showError(
    message,
    showRetry = true
) {
    if (!errorContainer) {
        return;
    }

    const retryButton =
        showRetry
            ? `
                <button
                    id="retryBtn"
                    type="button"
                    style="
                        margin-left: 10px;
                        background: #6366f1;
                        border: none;
                        color: #fff;
                        padding: 6px 12px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-weight: 700;
                    "
                >
                    RETRY
                </button>
            `
            : '';

    errorContainer.innerHTML = `
        <span>
            ⚠️ ${escapeHtml(message)}
        </span>
        ${retryButton}
    `;

    errorContainer.classList.remove(
        'hidden'
    );

    const retryBtn =
        document.getElementById(
            'retryBtn'
        );

    if (retryBtn) {
        retryBtn.addEventListener(
            'click',
            performSearch
        );
    }
}


// ============================================================
// CLOUDFLARE / ROBLOX API FETCHER
// ============================================================

async function fetchJson(
    url,
    options = {},
    timeout = 15000
) {
    const controller =
        new AbortController();

    const timeoutId =
        setTimeout(
            function () {
                controller.abort();
            },
            timeout
        );

    try {
        const proxyUrl =
            CLOUDFLARE_WORKER +
            '/?url=' +
            encodeURIComponent(url);

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
                'HTTP ' +
                response.status
            );
        }

        return await response.json();

    } catch (error) {

        if (
            error &&
            error.name === 'AbortError'
        ) {
            throw new Error(
                'The Roblox request timed out. Please try again.'
            );
        }

        throw error;

    } finally {
        clearTimeout(timeoutId);
    }
}


// ============================================================
// SAFE OPTIONAL API FETCH
// ============================================================

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
            'Optional Roblox API request failed:',
            url,
            error
        );

        return null;
    }
}


// ============================================================
// 3D AVATAR VIEWER
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

        console.warn(
            'Three.js is not loaded.'
        );

        return;
    }

    scene =
        new THREE.Scene();

    camera =
        new THREE.PerspectiveCamera(
            45,
            1,
            0.1,
            1000
        );

    camera.position.z = 2.7;

    renderer =
        new THREE.WebGLRenderer({
            antialias: true,
            alpha: true
        });

    renderer.setSize(
        115,
        115
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

    const geometry =
        new THREE.PlaneGeometry(
            2.1,
            2.1,
            32,
            32
        );

    avatarMesh = null;

    const textureLoader =
        new THREE.TextureLoader();

    textureLoader.crossOrigin =
        'anonymous';

    textureLoader.load(

        imageUrl,

        function (texture) {

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

            console.warn(
                'Could not load Roblox avatar image.'
            );

            const material =
                new THREE.MeshBasicMaterial({
                    color: 0x6366f1
                });

            avatarMesh =
                new THREE.Mesh(
                    geometry,
                    material
                );

            scene.add(
                avatarMesh
            );

            animate3D();
        }
    );


    container.addEventListener(
        'mousedown',
        function (event) {

            isDragging = true;

            previousMousePosition = {
                x: event.clientX,
                y: event.clientY
            };
        }
    );


    container.addEventListener(
        'touchstart',
        function (event) {

            if (!event.touches.length) {
                return;
            }

            isDragging = true;

            previousMousePosition = {
                x: event.touches[0].clientX,
                y: event.touches[0].clientY
            };
        },
        {
            passive: true
        }
    );
}


// ============================================================
// GLOBAL MOUSE MOVEMENT
// ============================================================

window.addEventListener(
    'mousemove',
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
            deltaY * 0.01;

        currentRotationVelocity =
            deltaX * 0.0005;

        previousMousePosition = {
            x: event.clientX,
            y: event.clientY
        };
    }
);


window.addEventListener(
    'mouseup',
    function () {
        isDragging = false;
    }
);


// ============================================================
// GLOBAL TOUCH MOVEMENT
// ============================================================

window.addEventListener(
    'touchmove',
    function (event) {

        if (
            !isDragging ||
            !avatarMesh
        ) {
            return;
        }

        if (!event.touches.length) {
            return;
        }

        const deltaX =
            event.touches[0].clientX -
            previousMousePosition.x;

        const deltaY =
            event.touches[0].clientY -
            previousMousePosition.y;

        avatarMesh.rotation.y +=
            deltaX * 0.01;

        avatarMesh.rotation.x +=
            deltaY * 0.01;

        currentRotationVelocity =
            deltaX * 0.0005;

        previousMousePosition = {
            x: event.touches[0].clientX,
            y: event.touches[0].clientY
        };
    },
    {
        passive: true
    }
);


window.addEventListener(
    'touchend',
    function () {
        isDragging = false;
    }
);


// ============================================================
// 3D ANIMATION
// ============================================================

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
            0.95;
    }

    renderer.render(
        scene,
        camera
    );
}


// ============================================================
// FIND ROBLOX USER
// ============================================================

async function findRobloxUser(
    username
) {

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

    const exactMatch =
        data.data.find(
            function (user) {

                return (
                    user.name &&
                    user.name.toLowerCase() ===
                    username.toLowerCase()
                );
            }
        );

    if (exactMatch) {
        return exactMatch;
    }

    return data.data[0];
}


// ============================================================
// FETCH PROFILE DATA
// ============================================================

async function fetchProfileData(
    userId
) {

    const urls = {

        profile:
            'https://users.roblox.com/v1/users/' +
            userId,

        avatar:
            'https://thumbnails.roblox.com/v1/users/avatar-headshot' +
            '?userIds=' +
            userId +
            '&size=420x420' +
            '&format=Png' +
            '&isCircular=false',

        followers:
            'https://friends.roblox.com/v1/users/' +
            userId +
            '/followers/count',

        friends:
            'https://friends.roblox.com/v1/users/' +
            userId +
            '/friends/count',

        usernameHistory:
            'https://users.roblox.com/v1/users/' +
            userId +
            '/username-history',

        avatarRig:
            'https://avatar.roblox.com/v2/avatar/users/' +
            userId +
            '/avatar',

        groups:
            'https://groups.roblox.com/v1/users/' +
            userId +
            '/groups/roles',

        games:
            'https://games.roblox.com/v1/users/' +
            userId +
            '/games?limit=6',

        presence:
            'https://presence.roblox.com/v1/presence/users'
    };


    const results =
        await Promise.allSettled([

            optionalFetch(
                urls.profile
            ),

            optionalFetch(
                urls.avatar
            ),

            optionalFetch(
                urls.followers
            ),

            optionalFetch(
                urls.friends
            ),

            optionalFetch(
                urls.usernameHistory
            ),

            optionalFetch(
                urls.avatarRig
            ),

            optionalFetch(
                urls.groups
            ),

            optionalFetch(
                urls.games
            ),

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


    function getResult(index) {

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
            getResult(0),

        avatar:
            getResult(1),

        followers:
            getResult(2),

        friends:
            getResult(3),

        usernameHistory:
            getResult(4),

        avatarRig:
            getResult(5),

        groups:
            getResult(6),

        games:
            getResult(7),

        presence:
            getResult(8)
    };
}


// ============================================================
// UPDATE IDENTITY
// ============================================================

function updateIdentity(
    user,
    profile
) {

    const displayName =
        profile?.displayName ||
        user?.displayName ||
        user?.name ||
        'Unknown';

    const username =
        profile?.name ||
        user?.name ||
        'Unknown';

    setText(
        'displayName',
        displayName
    );

    setText(
        'userName',
        '@' + username
    );

    const badgeEl =
        document.getElementById(
            'verifiedBadge'
        );

    if (badgeEl) {

        badgeEl.classList.toggle(
            'hidden',
            !profile?.hasVerifiedBadge
        );
    }
}


// ============================================================
// UPDATE AVATAR
// ============================================================

function updateAvatar(
    avatar
) {

    let avatarUrl =
        'https://tr.rbxcdn.com/30day-avatar/420/420/AvatarHeadshot/Png';

    if (
        avatar &&
        Array.isArray(avatar.data) &&
        avatar.data.length > 0 &&
        avatar.data[0].imageUrl
    ) {

        avatarUrl =
            avatar.data[0].imageUrl;
    }

    init3DViewer(
        avatarUrl
    );
}


// ============================================================
// UPDATE STATS
// ============================================================

function updateStats(
    data
) {

    setText(
        'createdDate',
        formatDate(
            data.profile?.created
        )
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
        'rigType',

        data.avatarRig?.playerAvatarType ||
        'N/A'
    );
}


// ============================================================
// UPDATE PRESENCE
// ============================================================

function updatePresence(
    presenceData
) {

    const statusElement =
        document.getElementById(
            'onlineStatus'
        );

    const lastOnlineElement =
        document.getElementById(
            'lastOnline'
        );

    if (!statusElement) {
        return;
    }

    let presence = null;

    if (
        presenceData &&
        Array.isArray(
            presenceData.userPresences
        ) &&
        presenceData.userPresences.length > 0
    ) {

        presence =
            presenceData.userPresences[0];
    }

    if (!presence) {

        statusElement.textContent =
            'UNKNOWN';

        statusElement.className =
            'status-pill';

        if (lastOnlineElement) {

            lastOnlineElement.textContent =
                'Status unavailable';
        }

        return;
    }


    const presenceType =
        Number(
            presence.userPresenceType
        );


    let statusText =
        'OFFLINE';


    if (presenceType === 1) {

        statusText =
            'ONLINE';

    } else if (presenceType === 2) {

        statusText =
            'IN GAME';

    } else if (presenceType === 3) {

        statusText =
            'IN STUDIO';
    }


    statusElement.textContent =
        statusText;


    statusElement.className =
        presenceType === 0
            ? 'status-pill'
            : 'status-pill online';


    if (lastOnlineElement) {

        if (presence.lastLocation) {

            lastOnlineElement.textContent =
                presence.lastLocation;

        } else {

            lastOnlineElement.textContent =
                statusText === 'OFFLINE'
                    ? 'Currently offline'
                    : 'Active';
        }
    }
}


// ============================================================
// UPDATE USERNAME HISTORY
// ============================================================

function updateUsernameHistory(
    history
) {

    const container =
        document.getElementById(
            'pastUsernames'
        );

    if (!container) {
        return;
    }

    if (
        history &&
        Array.isArray(history.data) &&
        history.data.length > 0
    ) {

        container.innerHTML =
            history.data
                .map(
                    function (item) {

                        return `
                            <span class="tag">
                                ${escapeHtml(item.name)}
                            </span>
                        `;
                    }
                )
                .join('');

    } else {

        container.innerHTML =
            '<span class="empty-hint">No past aliases</span>';
    }
}


// ============================================================
// UPDATE GROUPS
// ============================================================

function updateGroups(
    groups
) {

    const container =
        document.getElementById(
            'groupsList'
        );

    if (!container) {
        return;
    }

    if (
        groups &&
        Array.isArray(groups.data) &&
        groups.data.length > 0
    ) {

        container.innerHTML =
            groups.data
                .slice(0, 4)
                .map(
                    function (groupData) {

                        const groupName =
                            groupData?.group?.name ||
                            'Unknown group';

                        const roleName =
                            groupData?.role?.name ||
                            'Unknown role';

                        return `
                            <span
                                class="tag"
                                title="${escapeHtml(roleName)}"
                            >
                                ${escapeHtml(groupName)}
                            </span>
                        `;
                    }
                )
                .join('');

    } else {

        container.innerHTML =
            '<span class="empty-hint">No public organizations</span>';
    }
}


// ============================================================
// UPDATE EXPERIENCES
// ============================================================

function updateGames(
    games
) {

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

    if (
        !games ||
        !Array.isArray(games.data) ||
        games.data.length === 0
    ) {

        container.innerHTML =
            '<span class="empty-hint">No public experiences found</span>';

        if (visitsElement) {
            visitsElement.textContent =
                'N/A';
        }

        return;
    }


    let totalVisits = 0;


    container.innerHTML =
        games.data
            .map(
                function (game) {

                    const gameName =
                        game?.name ||
                        'Unnamed experience';

                    const visits =
                        Number(
                            game?.placeVisits
                        ) || 0;

                    totalVisits +=
                        visits;

                    return `
                        <div class="exp-card">
                            <h4>
                                ${escapeHtml(gameName)}
                            </h4>

                            <p>
                                Visits:
                                ${formatNumber(visits)}
                            </p>
                        </div>
                    `;
                }
            )
            .join('');


    if (visitsElement) {

        visitsElement.textContent =
            formatNumber(
                totalVisits
            );
    }
}


// ============================================================
// MAIN SEARCH
// ============================================================

async function performSearch() {

    const username =
        usernameInput?.value?.trim();


    if (!username) {

        showError(
            'Please enter a Roblox username.',
            false
        );

        return;
    }


    const requestId =
        ++currentRequestId;


    showLoading(true);

    clearError();

    showProfile(false);


    if (searchBtn) {
        searchBtn.disabled = true;
    }


    try {

        // ----------------------------------------------------
        // STEP 1 - FIND USER
        // ----------------------------------------------------

        let user;


        try {

            user =
                await findRobloxUser(
                    username
                );

        } catch (error) {

            console.error(
                'Roblox user search failed:',
                error
            );

            throw new Error(
                'Roblox search is temporarily unavailable. Please try again in a moment.'
            );
        }


        if (
            requestId !==
            currentRequestId
        ) {
            return;
        }


        if (!user) {

            throw new Error(
                'No Roblox user named "' +
                username +
                '" was found.'
            );
        }


        const userId =
            user.id;


        // ----------------------------------------------------
        // STEP 2 - FETCH PROFILE
        // ----------------------------------------------------

        const data =
            await fetchProfileData(
                userId
            );


        if (
            requestId !==
            currentRequestId
        ) {
            return;
        }


        // ----------------------------------------------------
        // STEP 3 - UPDATE UI
        // ----------------------------------------------------

        updateIdentity(
            user,
            data.profile
        );

        updateAvatar(
            data.avatar
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


        // ----------------------------------------------------
        // STEP 4 - SHOW PROFILE
        // ----------------------------------------------------

        showProfile(true);


        const successfulRequests = [

            data.profile,
            data.avatar,
            data.followers,
            data.friends,
            data.usernameHistory,
            data.avatarRig,
            data.groups,
            data.games,
            data.presence

        ].filter(
            Boolean
        ).length;


        if (
            successfulRequests < 3
        ) {

            showError(
                'The Roblox profile was found, but some profile information could not be loaded.',
                true
            );
        }


    } catch (error) {

        console.error(
            'Profile search error:',
            error
        );


        if (
            requestId !==
            currentRequestId
        ) {
            return;
        }


        showProfile(true);


        showError(
            error?.message ||
            'Something went wrong while searching Roblox.',
            true
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
            }
        }
    }
}


// ============================================================
// URL SEARCH
// ============================================================

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
            'Could not read URL parameters:',
            error
        );
    }
}


loadUsernameFromUrl();
```
