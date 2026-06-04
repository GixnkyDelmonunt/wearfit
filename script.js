const USERS_API = "https://users.roproxy.com/v1/users/";
const AVATAR_THUMBNAILS_API = "https://thumbnails.roproxy.com/v1/users/avatar?size=420x420&format=Png&isCircular=false&userIds=";
const AVATAR_API = "https://avatar.roproxy.com/v1/";
const OUTFIT_THUMBNAILS_API = "https://thumbnails.roproxy.com/v1/users/outfits?size=150x150&format=Png&isCircular=false&userOutfitIds=";

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
    
    statusText.textContent = "Scanning for all outfits... (this might take a moment)";
    outfitsContainer.innerHTML = "";

    try {
        let allOutfits = [];
        let page = 1;
        let isFetching = true;

        // 3. PAGINATION: Loop through every page to bypass the default 25 limit
        while (isFetching) {
            // isEditable=true & outfitType=Avatar ensures we ONLY get custom outfits, no bundles or heads
            // itemsPerPage=50 grabs the maximum allowed per request to speed up the loop
            const endpoint = AVATAR_API + `users/${userId}/outfits?page=${page}&itemsPerPage=50&isEditable=true&outfitType=Avatar`;
            const outfitsRes = await fetch(endpoint);
            
            if (!outfitsRes.ok) throw new Error("API failed to load outfits.");
            const outfitsData = await outfitsRes.json();

            if (outfitsData.data && outfitsData.data.length > 0) {
                allOutfits = allOutfits.concat(outfitsData.data);
                statusText.textContent = `Scanned ${allOutfits.length} custom outfits...`;

                // If Roblox returns fewer than 50 outfits, we know we've reached the final page
                if (outfitsData.data.length < 50) {
                    isFetching = false;
                } else {
                    page++; // Go to the next page
                }
            } else {
                isFetching = false; // No data returned
            }
        }

        const outfits = allOutfits;

        if (!outfits || outfits.length === 0) {
            statusText.textContent = "No saved outfits found, or their inventory is private.";
            return;
        }

        statusText.textContent = `Found a total of ${outfits.length} custom outfits. Fetching images...`;

        const thumbnailMap = {};
        const chunkSize = 50; 

        // 4. CHUNKING: Fetch the 2D images in batches of 50 to avoid URL length limits
        for (let i = 0; i < outfits.length; i += chunkSize) {
            const chunk = outfits.slice(i, i + chunkSize);
            const outfitIds = chunk.map(outfit => outfit.id).join(',');
            
            try {
                const thumbnailsRes = await fetch(OUTFIT_THUMBNAILS_API + outfitIds);
                const thumbnailsData = await thumbnailsRes.json();

                if (thumbnailsData.data) {
                    thumbnailsData.data.forEach(thumb => {
                        if (thumb.state === "Completed") {
                            thumbnailMap[thumb.targetId] = thumb.imageUrl;
                        }
                    });
                }
            } catch (err) {
                console.warn("A batch of images failed to load.", err);
            }
        }

        statusText.textContent = `Successfully loaded all ${outfits.length} outfits.`;

        // 5. Render every single outfit
        outfits.forEach(outfit => {
            const imageUrl = thumbnailMap[outfit.id];
            const outfitDiv = document.createElement('div');
            outfitDiv.className = 'outfit-card';
            
            let imageHtml = `<p style="color:#666; font-size:12px;">Image Pending</p>`;
            if (imageUrl) {
                imageHtml = `<img class="outfit-thumbnail" src="${imageUrl}" alt="Outfit Image">`;
            }

            outfitDiv.innerHTML = `
                <h3 title="${outfit.name}">${outfit.name}</h3>
                ${imageHtml}
                
                <div class="action-buttons">
                    <button onclick="fetchAccessories('${outfit.id}', this)">Accessories</button>
                    <button class="copy-btn" onclick="copyAvatarScript('${outfit.id}', this)">Use Avatar</button>
                </div>

                <div id="acc-${outfit.id}" class="accessories-list"></div>
            `;
            outfitsContainer.appendChild(outfitDiv);
        });

    } catch (error) {
        statusText.textContent = "Failed to load outfits. Rate limit hit or inventory private.";
        console.error(error);
    }
}

async function fetchAccessories(outfitId, buttonElement) {
    const accContainer = document.getElementById(`acc-${outfitId}`);
    
    if (accContainer.innerHTML !== "") {
        const isHidden = accContainer.style.display === "none";
        accContainer.style.display = isHidden ? "block" : "none";
        return;
    }

    const originalText = buttonElement.textContent;
    buttonElement.textContent = "...";

    try {
        const detailsRes = await fetch(AVATAR_API + `outfits/${outfitId}/details`);
        const detailsData = await detailsRes.json();

        let assetsHtml = "<ul>";
        if (detailsData.assets && detailsData.assets.length > 0) {
            detailsData.assets.forEach(asset => {
                assetsHtml += `<li><strong>${asset.name}</strong> <br><span style="color:#888; font-size:12px;">ID: ${asset.id}</span></li>`;
            });
        } else {
            assetsHtml += "<li>No accessories found.</li>";
        }
        assetsHtml += "</ul>";

        accContainer.innerHTML = assetsHtml;
        accContainer.style.display = "block";
        buttonElement.textContent = originalText;

    } catch (error) {
        buttonElement.textContent = "Error";
    }
}

// Generates the Lua script and copies it to the user's clipboard
function copyAvatarScript(outfitId, buttonElement) {
    const luaCode = `-- Local Avatar Changer Script
local Players = game:GetService("Players")
local player = Players.LocalPlayer
local character = player.Character or player.CharacterAdded:Wait()
local humanoid = character:WaitForChild("Humanoid")

local targetOutfitId = ${outfitId}

print("Fetching Outfit: " .. targetOutfitId)

local success, description = pcall(function()
    return Players:GetHumanoidDescriptionFromOutfitId(targetOutfitId)
end)

if success and description then
    local applySuccess, err = pcall(function()
        humanoid:ApplyDescription(description)
    end)
    
    if applySuccess then
        print("Avatar successfully changed locally!")
    else
        warn("Your executor failed to apply the description: " .. tostring(err))
    end
else
    warn("Failed to load outfit. The inventory might be private.")
end`;

    navigator.clipboard.writeText(luaCode).then(() => {
        const originalText = buttonElement.textContent;
        const originalBg = buttonElement.style.backgroundColor;
        
        buttonElement.textContent = "Copied!";
        buttonElement.style.backgroundColor = "#10b981"; 
        
        setTimeout(() => {
            buttonElement.textContent = originalText;
            buttonElement.style.backgroundColor = originalBg;
        }, 2000);
    }).catch(err => {
        alert("Clipboard copy failed. Make sure you are not blocking clipboard permissions.");
        console.error("Clipboard Error:", err);
    });
}
