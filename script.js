console.log("RoSearcher script loaded successfully!");

const searchBtn = document.getElementById("searchBtn");
const usernameInput = document.getElementById("usernameInput");

if (searchBtn) {
    searchBtn.addEventListener("click", function () {
        const username = usernameInput.value.trim();

        if (!username) {
            alert("Enter a Roblox username.");
            return;
        }

        alert("Search button works! Username: " + username);
    });
}

if (usernameInput) {
    usernameInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            searchBtn.click();
        }
    });
}
