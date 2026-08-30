// ============================================================
// RoSearcher
// Roblox public profile lookup
// GitHub Pages + Cloudflare Worker
// ============================================================

const WORKER =
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

let requestNumber = 0;

let avatarScene = null;
let avatarCamera = null;
let avatarRenderer = null;
let avatarMesh = null;

let dragging = false;

let previousMouse = {
    x: 0,
    y: 0
};


// ============================================================
// EVENTS
// ============================================================

if (searchBtn) {
    searchBtn.addEventListener(
        'click',
        performSearch
    );
}

if (usernameInput) {
    usernameInput.addEventListener(
        'keydown',
        function (event) {

            if (event.key === 'Enter') {
                event.preventDefault();
                performSearch();
            }

        }
    );
}


document.querySelectorAll(
    '.show-all-btn'
).forEach(function (button) {

    button.addEventListener(
        'click',
        function () {

            const targetId =
                button.dataset.target;

            const target =
                document.getElementById(
                    targetId
                );

            if (!target) {
                return;
            }

            const expanded =
                target.classList.toggle(
                    'expanded'
                );

            target.classList.toggle(
                'collapsed',
                !expanded
            );

            button.textContent =
                expanded
                    ? 'Show Less'
                    : 'Show All';
        }
    );
});


// ============================================================
// HELPERS
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

    const number =
        Number(value);

    if (!Number.isFinite(number)) {
        return 'N/A';
    }

    return number.toLocaleString();
}


function formatDate(value) {

    if (!value) {
        return 'N/A';
    }

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return 'N/A';
    }

    return date.toLocaleString(
        undefined,
        {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        }
    );
}


function formatDateOnly(value) {

    if (!value) {
        return 'N/A';
    }

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
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


function calculateAge(created) {

    if (!created) {
        return 'N/A';
    }

    const date =
        new Date(created);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return 'N/A';
    }

    const now =
        new Date();

    let years =
        now.getFullYear() -
        date.getFullYear();

    let months =
        now.getMonth() -
        date.getMonth();

    if (
        months < 0 ||
        (
            months === 0 &&
            now.getDate() <
            date.getDate()
        )
    ) {
        years--;
    }

    if (years < 1) {

        const days =
            Math.floor(
                (
                    now.getTime() -
                    date.getTime()
                ) /
                86400000
            );

        return days + ' days';
    }

    return years +
        (
            years === 1
                ? ' year'
                : ' years'
        );
}


function setText(id, value) {

    const element =
        document.getElementById(id);

    if (element) {
        element.textContent =
            value === null ||
            value === undefined
                ? 'N/A'
                : value;
    }
}


function setLink(id, url) {

    const element =
        document.getElementById(id);

    if (!element) {
        return;
    }

    if (!url) {

        element.removeAttribute(
            'href'
        );

        element.classList.add(
            'disabled'
        );

        return;
    }

    element.href = url;

    element.classList.remove(
        'disabled'
    );
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
    retry = true
) {

    if (!errorContainer) {
        return;
    }

    errorContainer.innerHTML = `
        <span>
            ⚠️ ${escapeHtml(message)}
        </span>

        ${
            retry
                ? `
                    <button
                        id="retryBtn"
                        type="button"
                        style="
                            margin-left:10px;
                            padding:6px 10px;
                            border:0;
                            border-radius:6px;
                            background:#6366f1;
                            color:white;
                            cursor:pointer;
                            font-weight:700;
                        "
                    >
                        Retry
                    </button>
                `
                : ''
        }
    `;

    errorContainer.classList.remove(
        'hidden'
    );

    const retryButton =
        document.getElementById(
            'retryBtn'
        );

    if (retryButton) {

        retryButton.addEventListener(
            'click',
            performSearch
        );
    }
}


// ============================================================
// WORKER REQUEST
// ============================================================

async function request(
    targetUrl,
    options = {},
    timeout = 20000
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

        const workerUrl =
            WORKER +
            '/?url=' +
            encodeURIComponent(
                targetUrl
            );

        const fetchOptions = {
            method:
                options.method ||
                'GET',

            signal:
                controller.signal,

            headers: {
                Accept:
                    'application/json',

                ...(options.headers || {})
            }
        };

        if (
            options.body !==
            undefined
        ) {
            fetchOptions.body =
                options.body;
        }

        const response =
            await fetch(
                workerUrl,
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
            error.name ===
            'AbortError'
        ) {

            throw new Error(
                'The request timed out.'
            );
        }

        throw error;

    } finally {

        clearTimeout(
            timeoutId
        );
    }
}


async function optionalRequest(
    url,
    options = {}
) {

    try {

        return await request(
            url,
            options
        );

    } catch (error) {

        console.warn(
            'Request failed:',
            url,
            error
        );

        return null;
    }
}


// ============================================================
// FIND USER
// ============================================================

async function findUser(
    username
) {

    const url =
        'https://users.roblox.com/v1/users/search' +
        '?keyword=' +
        encodeURIComponent(
            username
        ) +
        '&limit=10';

    const data =
        await request(url);

    if (
        !data ||
        !Array.isArray(data.data) ||
        data.data.length === 0
    ) {
        return null;
    }

    const exact =
        data.data.find(
            function (user) {

                return (
                    user.name &&
                    user.name.toLowerCase() ===
                    username.toLowerCase()
                );
            }
        );

    return exact ||
        data.data[0];
}


// ============================================================
// FETCH EVERYTHING
// ============================================================

async function fetchUserData(
    userId
) {

    const urls = {

        profile:
            'https://users.roblox.com/v1/users/' +
            userId,

        avatar:
            'https://avatar.roblox.com/v1/users/' +
            userId +
            '/avatar',

        wearing:
            'https://avatar.roblox.com/v1/users/' +
            userId +
            '/currently-wearing',

        thumbnail:
            'https://thumbnails.roblox.com/v1/users/avatar' +
            '?userIds=' +
            userId +
            '&size=420x420' +
            '&format=Png' +
            '&isCircular=false',

        followers:
            'https://friends.roblox.com/v1/users/' +
            userId +
            '/followers/count',

        following:
            'https://friends.roblox.com/v1/users/' +
            userId +
            '/followings/count',

        friends:
            'https://friends.roblox.com/v1/users/' +
            userId +
            '/friends/count',

        usernameHistory:
            'https://users.roblox.com/v1/users/' +
            userId +
            '/username-history',

        groups:
            'https://groups.roblox.com/v1/users/' +
            userId +
            '/groups/roles',

        games:
            'https://games.roblox.com/v2/users/' +
            userId +
            '/games?limit=50&sortOrder=Asc',

        favorites:
            'https://games.roblox.com/v2/users/' +
            userId +
            '/favorite/games?limit=50&sortOrder=Asc',

        presence:
            'https://presence.roblox.com/v1/presence/users'
    };


    const results =
        await Promise.allSettled([

            optionalRequest(
                urls.profile
            ),

            optionalRequest(
                urls.avatar
            ),

            optionalRequest(
                urls.wearing
            ),

            optionalRequest(
                urls.thumbnail
            ),

            optionalRequest(
                urls.followers
            ),

            optionalRequest(
                urls.following
            ),

            optionalRequest(
                urls.friends
            ),

            optionalRequest(
                urls.usernameHistory
            ),

            optionalRequest(
                urls.groups
            ),

            optionalRequest(
                urls.games
            ),

            optionalRequest(
                urls.favorites
            ),

            optionalRequest(
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


    function result(index) {

        const item =
            results[index];

        if (
            item &&
            item.status ===
            'fulfilled'
        ) {
            return item.value;
        }

        return null;
    }


    return {

        profile:
            result(0),

        avatar:
            result(1),

        wearing:
            result(2),

        thumbnail:
            result(3),

        followers:
            result(4),

        following:
            result(5),

        friends:
            result(6),

        usernameHistory:
            result(7),

        groups:
            result(8),

        games:
            result(9),

        favorites:
            result(10),

        presence:
            result(11)
    };
}


// ============================================================
// PROFILE
// ============================================================

function updateProfile(
    user,
    data
) {

    const profile =
        data.profile ||
        user;

    const userId =
        profile.id ||
        user.id;

    const username =
        profile.name ||
        user.name ||
        'Unknown';

    const displayName =
        profile.displayName ||
        user.displayName ||
        username;


    setText(
        'displayName',
        displayName
    );

    setText(
        'userName',
        '@' + username
    );

    setText(
        'userId',
        userId
    );

    setText(
        'infoUsername',
        username
    );

    setText(
        'infoDisplayName',
        displayName
    );

    setText(
        'createdDate',
        formatDateOnly(
            profile.created
        )
    );

    setText(
        'accountAge',
        calculateAge(
            profile.created
        )
    );

    setText(
        'description',
        profile.description ||
        'No description.'
    );


    const verified =
        Boolean(
            profile.hasVerifiedBadge
        );

    setText(
        'verifiedText',
        verified
            ? 'Yes'
            : 'No'
    );


    const badge =
        document.getElementById(
            'verifiedBadge'
        );

    if (badge) {

        badge.classList.toggle(
            'hidden',
            !verified
        );
    }


    const profileUrl =
        'https://www.roblox.com/users/' +
        userId +
        '/profile';


    setLink(
        'profileLink',
        profileUrl
    );

    setLink(
        'profileLinkBottom',
        profileUrl
    );


    setLink(
        'avatarLink',
        'https://www.roblox.com/users/' +
        userId +
        '/avatar'
    );

    setLink(
        'friendsLink',
        'https://www.roblox.com/users/' +
        userId +
        '/friends'
    );

    setLink(
        'followersLink',
        'https://www.roblox.com/users/' +
        userId +
        '/followers'
    );

    setLink(
        'followingLink',
        'https://www.roblox.com/users/' +
        userId +
        '/following'
    );
}


// ============================================================
// COUNTS
// ============================================================

function updateCounts(data) {

    setText(
        'followersCount',
        data.followers?.count !==
        undefined
            ? formatNumber(
                data.followers.count
            )
            : 'N/A'
    );


    setText(
        'followingCount',
        data.following?.count !==
        undefined
            ? formatNumber(
                data.following.count
            )
            : 'N/A'
    );


    setText(
        'friendsCount',
        data.friends?.count !==
        undefined
            ? formatNumber(
                data.friends.count
            )
            : 'N/A'
    );
}


// ============================================================
// PRESENCE
// ============================================================

function updatePresence(
    presenceData
) {

    let presence = null;

    if (
        presenceData &&
        Array.isArray(
            presenceData.userPresences
        ) &&
        presenceData.userPresences.length
    ) {

        presence =
            presenceData.userPresences[0];
    }


    const status =
        document.getElementById(
            'onlineStatus'
        );


    const lastOnline =
        document.getElementById(
            'lastOnline'
        );


    if (!presence) {

        setText(
            'presenceStatus',
            'Unknown'
        );

        setText(
            'presenceLocation',
            'N/A'
        );

        setText(
            'presenceLastOnline',
            'N/A'
        );

        if (status) {

            status.textContent =
                'UNKNOWN';

            status.className =
                'status-pill';
        }

        if (lastOnline) {

            lastOnline.textContent =
                'Status unavailable';
        }

        return;
    }


    const type =
        Number(
            presence.userPresenceType
        );


    let text =
        'OFFLINE';


    if (type === 1) {
        text = 'ONLINE';
    }

    if (type === 2) {
        text = 'IN GAME';
    }

    if (type === 3) {
        text = 'IN STUDIO';
    }


    const location =
        presence.lastLocation ||
        'N/A';


    const last =
        presence.lastOnline
            ? formatDate(
                presence.lastOnline
            )
            : (
                type === 0
                    ? 'No recent time available'
                    : 'Currently active'
            );


    setText(
        'presenceStatus',
        text
    );

    setText(
        'presenceLocation',
        location
    );

    setText(
        'presenceLastOnline',
        last
    );


    if (status) {

        status.textContent =
            text;

        status.className =
            type === 0
                ? 'status-pill'
                : 'status-pill online';
    }


    if (lastOnline) {

        lastOnline.textContent =
            type === 0
                ? last
                : location !== 'N/A'
                    ? location
                    : 'Active';
    }
}


// ============================================================
// AVATAR
// ============================================================

function updateAvatar(
    data
) {

    let imageUrl = null;


    if (
        data.thumbnail &&
        Array.isArray(
            data.thumbnail.data
        ) &&
        data.thumbnail.data[0]
    ) {

        imageUrl =
            data.thumbnail.data[0].imageUrl;
    }


    if (!imageUrl) {

        imageUrl =
            'https://tr.rbxcdn.com/30day-avatar/420/420/Avatar.png';
    }


    initAvatarViewer(
        imageUrl
    );


    const avatar =
        data.avatar;


    if (avatar) {

        setText(
            'avatarType',
            avatar.playerAvatarType ||
            'N/A'
        );


        const scales =
            avatar.scales;


        if (scales) {

            const scaleText = [

                'Height ' +
                (scales.height ?? 'N/A'),

                'Width ' +
                (scales.width ?? 'N/A'),

                'Head ' +
                (scales.head ?? 'N/A'),

                'Body ' +
                (scales.bodyType ?? 'N/A'),

                'Proportion ' +
                (scales.proportion ?? 'N/A')

            ].join(' · ');


            setText(
                'avatarScale',
                scaleText
            );
        }


        const bodyColors =
            avatar.bodyColors;


        if (bodyColors) {

            const colorText =
                Object.keys(
                    bodyColors
                ).length +
                ' body color values';


            setText(
                'bodyColors',
                colorText
            );
        }

    }


    if (
        data.wearing &&
        Array.isArray(
            data.wearing.assetIds
        )
    ) {

        setText(
            'wearingCount',
            formatNumber(
                data.wearing.assetIds.length
            )
        );


        const assets =
            document.getElementById(
                'assetsList'
            );


        if (assets) {

            assets.innerHTML =
                data.wearing.assetIds
                    .map(
                        function (id) {

                            return `
                                <span class="asset">
                                    Asset ${escapeHtml(id)}
                                </span>
                            `;
                        }
                    )
                    .join('');
        }
    }
}


// ============================================================
// AVATAR VIEWER
// ============================================================

function initAvatarViewer(
    imageUrl
) {

    const container =
        document.getElementById(
            'canvasContainer'
        );

    if (!container) {
        return;
    }


    container.innerHTML = '';


    if (!window.THREE) {

        const image =
            document.createElement(
                'img'
            );

        image.src =
            imageUrl;

        image.alt =
            'Roblox avatar';

        image.style.width =
            '100%';

        image.style.height =
            '100%';

        image.style.objectFit =
            'contain';

        container.appendChild(
            image
        );

        return;
    }


    avatarScene =
        new THREE.Scene();


    avatarCamera =
        new THREE.PerspectiveCamera(
            35,
            190 / 230,
            0.1,
            100
        );


    avatarCamera.position.z =
        3;


    avatarRenderer =
        new THREE.WebGLRenderer({
            antialias: true,
            alpha: true
        });


    avatarRenderer.setSize(
        190,
        230
    );


    avatarRenderer.setPixelRatio(
        Math.min(
            window.devicePixelRatio || 1,
            2
        )
    );


    container.appendChild(
        avatarRenderer.domElement
    );


    const geometry =
        new THREE.PlaneGeometry(
            2.4,
            2.9
        );


    const loader =
        new THREE.TextureLoader();


    loader.crossOrigin =
        'anonymous';


    loader.load(

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


            avatarScene.add(
                avatarMesh
            );


            animateAvatar();
        },

        undefined,

        function () {

            console.warn(
                'Avatar thumbnail could not be loaded.'
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


            avatarScene.add(
                avatarMesh
            );


            animateAvatar();
        }
    );


    container.onmousedown =
        function (event) {

            dragging = true;

            previousMouse = {
                x: event.clientX,
                y: event.clientY
            };
        };


    container.ontouchstart =
        function (event) {

            if (!event.touches.length) {
                return;
            }

            dragging = true;

            previousMouse = {
                x:
                    event.touches[0].clientX,

                y:
                    event.touches[0].clientY
            };
        };
}


window.addEventListener(
    'mousemove',
    function (event) {

        if (
            !dragging ||
            !avatarMesh
        ) {
            return;
        }


        const dx =
            event.clientX -
            previousMouse.x;


        const dy =
            event.clientY -
            previousMouse.y;


        avatarMesh.rotation.y +=
            dx * 0.01;


        avatarMesh.rotation.x +=
            dy * 0.005;


        previousMouse = {
            x: event.clientX,
            y: event.clientY
        };
    }
);


window.addEventListener(
    'mouseup',
    function () {
        dragging = false;
    }
);


window.addEventListener(
    'touchmove',
    function (event) {

        if (
            !dragging ||
            !avatarMesh ||
            !event.touches.length
        ) {
            return;
        }


        const dx =
            event.touches[0].clientX -
            previousMouse.x;


        const dy =
            event.touches[0].clientY -
            previousMouse.y;


        avatarMesh.rotation.y +=
            dx * 0.01;


        avatarMesh.rotation.x +=
            dy * 0.005;


        previousMouse = {
            x:
                event.touches[0].clientX,

            y:
                event.touches[0].clientY
        };
    },
    {
        passive: true
    }
);


window.addEventListener(
    'touchend',
    function () {
        dragging = false;
    }
);


function animateAvatar() {

    if (
        !avatarRenderer ||
        !avatarScene ||
        !avatarCamera
    ) {
        return;
    }


    requestAnimationFrame(
        animateAvatar
    );


    if (
        avatarMesh &&
        !dragging
    ) {

        avatarMesh.rotation.y +=
            0.003;
    }


    avatarRenderer.render(
        avatarScene,
        avatarCamera
    );
}


// ============================================================
// USERNAME HISTORY
// ============================================================

function updateUsernameHistory(
    history
) {

    const container =
        document.getElementById(
            'usernameList'
        );

    if (!container) {
        return;
    }


    if (
        !history ||
        !Array.isArray(
            history.data
        ) ||
        !history.data.length
    ) {

        container.innerHTML =
            '<span class="empty">No previous usernames found.</span>';

        return;
    }


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
}


// ============================================================
// GROUPS
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
        !groups ||
        !Array.isArray(
            groups.data
        ) ||
        !groups.data.length
    ) {

        container.innerHTML =
            '<span class="empty">No public groups found.</span>';

        return;
    }


    container.innerHTML =
        groups.data
            .map(
                function (item) {

                    const group =
                        item.group ||
                        {};

                    const role =
                        item.role ||
                        {};


                    const id =
                        group.id;


                    const url =
                        id
                            ? 'https://www.roblox.com/communities/' +
                              id +
                              '/about'
                            : '#';


                    return `
                        <span class="tag">

                            <a
                                href="${url}"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                ${escapeHtml(
                                    group.name ||
                                    'Unknown Group'
                                )}
                            </a>

                            ·

                            ${escapeHtml(
                                role.name ||
                                'Member'
                            )}

                        </span>
                    `;
                }
            )
            .join('');
}


// ============================================================
// EXPERIENCES
// ============================================================

function updateGames(
    games
) {

    const container =
        document.getElementById(
            'gamesContainer'
        );

    if (!container) {
        return;
    }


    if (
        !games ||
        !Array.isArray(
            games.data
        ) ||
        !games.data.length
    ) {

        container.innerHTML =
            '<span class="empty">No public experiences found.</span>';

        return;
    }


    container.innerHTML =
        games.data
            .map(
                function (game) {

                    const universeId =
                        game.id ||
                        game.universeId;


                    const placeId =
                        game.rootPlaceId ||
                        game.placeId;


                    const url =
                        universeId
                            ? 'https://www.roblox.com/games/' +
                              (
                                  placeId ||
                                  universeId
                              )
                            : '#';


                    const name =
                        game.name ||
                        'Unnamed Experience';


                    const visits =
                        Number(
                            game.placeVisits
                        ) || 0;


                    const creator =
                        game.creator?.name ||
                        'Unknown';


                    const creatorId =
                        game.creator?.id;


                    const creatorUrl =
                        creatorId
                            ? 'https://www.roblox.com/users/' +
                              creatorId +
                              '/profile'
                            : '#';


                    return `
                        <article class="game-card">

                            <div class="game-card-top">

                                <div>
                                    <h4>

                                        <a
                                            href="${url}"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            ${escapeHtml(name)}
                                        </a>

                                    </h4>

                                    <p>
                                        ${formatNumber(visits)}
                                        visits
                                    </p>

                                </div>

                            </div>


                            <div class="game-meta">

                                <span class="meta">
                                    Universe:
                                    ${escapeHtml(
                                        universeId ||
                                        'N/A'
                                    )}
                                </span>

                                <span class="meta">
                                    Place:
                                    ${escapeHtml(
                                        placeId ||
                                        'N/A'
                                    )}
                                </span>

                                <span class="meta">
                                    Creator:
                                    <a
                                        href="${creatorUrl}"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style="color:inherit"
                                    >
                                        ${escapeHtml(
                                            creator
                                        )}
                                    </a>
                                </span>

                            </div>

                        </article>
                    `;
                }
            )
            .join('');
}


// ============================================================
// SEARCH
// ============================================================

async function performSearch() {

    const username =
        usernameInput?.value?.trim();


    if (!username) {

        showError(
            'Enter a Roblox username first.',
            false
        );

        return;
    }


    const currentRequest =
        ++requestNumber;


    showLoading(true);

    clearError();

    showProfile(false);


    if (searchBtn) {
        searchBtn.disabled =
            true;
    }


    try {

        const user =
            await findUser(
                username
            );


        if (
            currentRequest !==
            requestNumber
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


        const data =
            await fetchUserData(
                user.id
            );


        if (
            currentRequest !==
            requestNumber
        ) {
            return;
        }


        updateProfile(
            user,
            data
        );


        updateCounts(
            data
        );


        updatePresence(
            data.presence
        );


        updateAvatar(
            data
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


        showProfile(true);


        window.scrollTo({
            top:
                profileContainer.offsetTop -
                20,
            behavior: 'smooth'
        });


    } catch (error) {

        console.error(
            'RoSearcher error:',
            error
        );


        if (
            currentRequest !==
            requestNumber
        ) {
            return;
        }


        showError(
            error?.message ||
            'Something went wrong while searching Roblox.',
            true
        );


    } finally {

        if (
            currentRequest ===
            requestNumber
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

function loadSearchFromUrl() {

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
            'URL search failed:',
            error
        );
    }
}


loadSearchFromUrl();
