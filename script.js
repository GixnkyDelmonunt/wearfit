const USERS_API = "https://users.roproxy.com/v1/users/";
const AVATAR_THUMBNAILS_API = "https://thumbnails.roproxy.com/v1/users/avatar?size=420x420&format=Png&isCircular=false&userIds=";
const AVATAR_API = "https://avatar.roproxy.com/v1/";
// New API to fetch 2D outfit images
const OUTFIT_THUMBNAILS_API = "https://thumbnails.roproxy.com/v1/outfits?size=150x150&format=Png&isCircular=false&outfitIds=";

async function searchPlayer() {
    const userId = document.getElementById('userIdInput').value.trim();
    const statusText = document.getElementById('statusText');
    const profileContainer = document.getElementById('profileContainer');
    const outfitsContainer = document.getElementById('outfitsContainer');

    if (!userId) return;

    statusText.textContent = "Fetching player data...";
    profileContainer.innerHTML = "";
    outfitsContainer.innerHTML = "";

    try {
        // 1. Fetch User Info
        const userRes = await fetch(USERS_API + userId);
        if (!userRes.ok) throw new Error("Player not found.");
        const userData = await userRes.json();

        // 2. Fetch User Avatar Image
        const thumbRes = await fetch(AVATAR_THUMBNAILS_API + userId);
        const thumbData = await thumbRes.json();
        const avatarImageUrl = thumbData.data[0]?.imageUrl || "";

        // Render Profile Card
        profileContainer.innerHTML = `
            <div class="profile-card">
                <h2>${userData.displayName}</h2>
                <p style="color: #aaa;">@${userData.name}</p>
                ${avatarImageUrl ? `<img class="avatar-img" src="${avatarImageUrl}" alt="Avatar">` : ''}
                <br><br>
                <button onclick="fetchOutfits('${userId}')">Load Saved Outfits</button>
            </div>
        `;
        statusText.textContent = "";

    } catch (error) {
        statusText.textContent = "Error: " + error.message;
    }
}

async function fetchOutfits(userId) {
    const statusText = document.getElementById('statusText');
    const outfitsContainer = document.getElementById('outfitsContainer');
    
    statusText.textContent = "Loading outfits and generating 2D images...";
    outfitsContainer.innerHTML = "";

    try {
        // 3. Fetch list of outfits
        const outfitsRes = await fetch(AVATAR_API + `users/${userId}/outfits`);
        const outfitsData = await outfitsRes.json();

        const outfits = outfitsData.data;

        if (!outfits || outfits.length === 0) {
            statusText.textContent = "No saved outfits found, or their inventory is private.";
            return;
        }

        // 4. BATCH REQUEST: Extract all Outfit IDs to get their thumbnails at the exact same time
        const outfitIds = outfits.map(outfit => outfit.id).join(',');
        
        // Fetch all thumbnails in one single request to prevent rate limiting
        const thumbnailsRes = await fetch(OUTFIT_THUMBNAILS_API + outfitIds);
        const thumbnailsData = await thumbnailsRes.json();

        // Create a dictionary/map linking Outfit ID to its Image URL for fast lookup
        const thumbnailMap = {};
        if (thumbnailsData.data) {
            thumbnailsData.data.forEach(thumb => {
                thumbnailMap[thumb.targetId] = thumb.imageUrl;
            });
        }

        statusText.textContent = `Successfully loaded ${outfits.length} outfits.`;

        // 5. Render each outfit with its specific 2D image
        outfits.forEach(outfit => {
            const imageUrl = thumbnailMap[outfit.id] || ''; // Fallback if image fails
            
            const outfitDiv = document.createElement('div');
            outfitDiv.className = 'outfit-card';
            outfitDiv.innerHTML = `
                <h3 title="${outfit.name}">${outfit.name}</h3>
                ${imageUrl ? `<img class="outfit-thumbnail" src="${imageUrl}" alt="Outfit Image">` : '<p style="color:#666;">No Image</p>'}
                <button onclick="fetchAccessories('${outfit.id}', this)">View Accessories</button>
                <div id="acc-${outfit.id}" class="accessories-list"></div>
            `;
            outfitsContainer.appendChild(outfitDiv);
        });

    } catch (error) {
        statusText.textContent = "Failed to load outfits. (API Rate limit or private inventory)";
        console.error(error);
    }
}

async function fetchAccessories(outfitId, buttonElement) {
    const accContainer = document.getElementById(`acc-${outfitId}`);
    
    if (accContainer.innerHTML !== "") {
        const isHidden = accContainer.style.display === "none";
        accContainer.style.display = isHidden ? "block" : "none";
        buttonElement.textContent = isHidden ? "Hide Accessories" : "View Accessories";
        return;
    }

    buttonElement.textContent = "Loading...";

    try {
        const detailsRes = await fetch(AVATAR_API + `outfits/${outfitId}/details`);
        const detailsData = await detailsRes.json();

        let assetsHtml = "<ul>";
        if (detailsData.assets && detailsData.assets.length > 0) {
            detailsData.assets.forEach(asset => {
                assetsHtml += `<li><strong>${asset.name}</strong> <br><span style="color:#888; font-size:12px;">ID: ${asset.id}</span></li>`;
            });
        } else {
            assetsHtml += "<li>No accessories/assets found.</li>";
        }
        assetsHtml += "</ul>";

        accContainer.innerHTML = assetsHtml;
        accContainer.style.display = "block";
        buttonElement.textContent = "Hide Accessories";

    } catch (error) {
        buttonElement.textContent = "Error loading";
    }
}
