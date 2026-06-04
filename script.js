const USERS_API = "https://users.roproxy.com/v1/users/";
const AVATAR_THUMBNAILS_API = "https://thumbnails.roproxy.com/v1/users/avatar?size=420x420&format=Png&isCircular=false&userIds=";
const AVATAR_API = "https://avatar.roproxy.com/v1/";
const OUTFIT_THUMBNAILS_API = "https://thumbnails.roproxy.com/v1/users/outfits?size=150x150&format=Png&isCircular=false&userOutfitIds=";

// NEW: A robust helper function that automatically retries failed network requests
async function fetchWithRetry(url, retries = 3, delay = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url);
            if (response.ok) return response;
            
            // If we get rate limited (429), wait a bit longer before retrying
            if (response.status === 429) {
                await new Promise(res => setTimeout(res, delay * 2));
                continue;
            }
        } catch (err) {
            if (i === retries - 1) throw err; // Out of retries, throw the error
        }
        // Wait before trying again
        await new Promise(res => setTimeout(res, delay));
    }
    throw new Error(`Failed to fetch after ${retries} attempts.`);
}

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
        // Fetch User Info with retry reliability
        const userRes = await fetchWithRetry(USERS_API + userId);
        const userData = await userRes.json();

        // Fetch User Avatar Image with retry reliability
        const thumbRes = await fetchWithRetry(AVATAR_THUMBNAILS_API + userId);
        const thumbData = await thumbRes.json();
        const avatarImageUrl = thumbData.data[0]?.imageUrl || "";

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
        statusText.textContent = "Error: Player not found or Proxy Connection dropped.";
    }
}

async function fetchOutfits(userId) {
    const statusText = document.getElementById('statusText');
    const outfitsContainer = document.getElementById('outfitsContainer');
    
    statusText.textContent = "Connecting to Roblox servers...";
    outfitsContainer.innerHTML = "";

    try {
        let allOutfits = [];
        let page = 1;
        let isFetching = true;

        while (isFetching) {
            statusText.textContent = `Scanning page ${page} for outfits...`;
            
            // FIXED: Removed 'isEditable' from URL to prevent false-negatives on certain public accounts
            const endpoint = AVATAR_API + `users/${userId}/outfits?page=${page}&itemsPerPage=50`;
            const outfitsRes = await fetchWithRetry(endpoint);
            const outfitsData = await outfitsRes.json();

            if (outfitsData.data && outfitsData.data.length > 0) {
                // FIXED: Filter out Dynamic Heads and Bundles right here in JavaScript instead of relying on the API URL
                const cleanOutfits = outfitsData.data.filter(outfit => 
                    outfit.outfitType === "Avatar" || outfit.outfitType === "Classic" || !outfit.outfitType
                );

                allOutfits = allOutfits.concat(cleanOutfits);

                if (outfitsData.data.length < 50) {
                    isFetching = false; // Reached the absolute end
                } else {
                    page++;
                }
            } else {
                isFetching = false;
            }
        }

        if (allOutfits.length === 0) {
            statusText.textContent = "No saved outfits found, or their inventory is private.";
            return;
        }

        statusText.textContent = `Found ${allOutfits.length} custom outfits. Downloading 2D images...`;

        const thumbnailMap = {};
        const chunkSize = 50; 

        // Fetch images in chunks with automatic retry capabilities
        for (let i = 0; i < allOutfits.length; i += chunkSize) {
            const chunk = allOutfits.slice(i, i + chunkSize);
            const outfitIds = chunk.map(outfit => outfit.id).join(',');
            
            try {
                const thumbnailsRes = await fetchWithRetry(OUTFIT_THUMBNAILS_API + outfitIds);
                const thumbnailsData = await thumbnailsRes.json();

                if (thumbnailsData.data) {
                    thumbnailsData.data.forEach(thumb => {
                        if (thumb.state === "Completed") {
                            thumbnailMap[thumb.targetId] = thumb.imageUrl;
                        }
                    });
                }
            } catch (err) {
                console.warn("A chunk of thumbnails failed, skipping to preserve operation...", err);
            }
        }

        statusText.textContent = `Successfully loaded all ${allOutfits.length} outfits!`;

        // Render everything flawlessly
        allOutfits.forEach(outfit => {
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
        statusText.textContent = "Failed to load outfits. The proxy might be overloaded right now. Try again in a few seconds.";
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
        const detailsRes = await fetchWithRetry(AVATAR_API + `outfits/${outfitId}/details`);
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
        alert("Clipboard copy failed.");
        console.error("Clipboard Error:", err);
    });
}
