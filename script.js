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
    const luaCode = `-- Local Avatar Changer Script (Manual Motor6D & Asset Extraction)
local targetOutfitId = ${outfitId}

local Players = game:GetService("Players")
local localPlayer = Players.LocalPlayer

if _G.__AppearanceConnection then
\t_G.__AppearanceConnection:Disconnect()
end

local ATTACHMENTS_INFO = {
\tHatAttachment = {ParentName = "Head", CFrame = CFrame.new(0, 0.5, 0)},
\tHairAttachment = {ParentName = "Head", CFrame = CFrame.new(0, 0.5, 0)},
\tFaceFrontAttachment = {ParentName = "Head", CFrame = CFrame.new(0, 0.3, 0.1)},
\tFaceCenterAttachment = {ParentName = "Head", CFrame = CFrame.new(0, 0.3, 0)},
\tBackAttachment = {ParentName = "Torso", CFrame = CFrame.new(0, 0, -0.5)},
\tFrontAttachment = {ParentName = "Torso", CFrame = CFrame.new(0, 0, 0.5)},
\tWaistAttachment = {ParentName = "Torso", CFrame = CFrame.new(0, -0.5, 0)},
\tWaistFrontAttachment = {ParentName = "Torso", CFrame = CFrame.new(0, -0.5, 0.1)},
\tWaistBackAttachment = {ParentName = "Torso", CFrame = CFrame.new(0, -0.5, -0.1)},
\tNeckAttachment = {ParentName = "Torso", CFrame = CFrame.new(0, 1, 0)},
\tBodyBackAttachment = {ParentName = "Torso", CFrame = CFrame.new(0, 0, -0.5)},
\tBodyFrontAttachment = {ParentName = "Torso", CFrame = CFrame.new(0, 0, 0.5)},
\tLeftCollarAttachment = {ParentName = "Torso", CFrame = CFrame.new(-1, 0.5, 0)},
\tRightCollarAttachment = {ParentName = "Torso", CFrame = CFrame.new(1, 0.5, 0)},
\tRightGripAttachment = {ParentName = "Right Arm", CFrame = CFrame.new(0, -1, 0)},
}

local function ensureAttachment(character, name)
\tlocal info = ATTACHMENTS_INFO[name]
\tif not info then return end
\tlocal part = character:FindFirstChild(info.ParentName)
\tif not part then return end

\tlocal att = part:FindFirstChild(name)
\tif not att then
\t\tatt = Instance.new("Attachment")
\t\tatt.Name = name
\t\tatt.CFrame = info.CFrame
\t\tatt.Parent = part
\tend
\treturn att
end

local function attachAccessory(character, accessory)
\tlocal handle = accessory:FindFirstChild("Handle")
\tif not handle then return end

\thandle.CanCollide = false
\thandle.Massless = true

\tfor _, child in ipairs(handle:GetChildren()) do
\t\tif child:IsA("Weld") or child:IsA("Motor6D") then
\t\t\tchild:Destroy()
\t\tend
\tend

\tlocal handleAttachments = {}
\tfor _, att in ipairs(handle:GetChildren()) do
\t\tif att:IsA("Attachment") then
\t\t\ttable.insert(handleAttachments, att)
\t\tend
\tend

\tif #handleAttachments == 0 then
\t\tlocal defaultAttachment = Instance.new("Attachment")
\t\tdefaultAttachment.Name = "HandleAttachment"
\t\tdefaultAttachment.CFrame = CFrame.new(0, 0, 0)
\t\tdefaultAttachment.Parent = handle
\t\ttable.insert(handleAttachments, defaultAttachment)
\tend

\tfor _, handleAtt in ipairs(handleAttachments) do
\t\tlocal charAtt = ensureAttachment(character, handleAtt.Name)
\t\tif not charAtt then continue end

\t\tlocal joint = Instance.new("Motor6D")
\t\tjoint.Name = "AccessoryMotor6D"
\t\tjoint.Part0 = charAtt.Parent
\t\tjoint.Part1 = handle
\t\tjoint.C0 = charAtt.CFrame
\t\tjoint.C1 = handleAtt.CFrame
\t\tjoint.Parent = handle
\tend

\taccessory.Parent = character
end

local function clearAppearance(character)
\tfor _, obj in ipairs(character:GetChildren()) do
\t\tif obj:IsA("Accoutrement") or obj:IsA("Shirt") or obj:IsA("Pants") or 
\t\t   obj:IsA("ShirtGraphic") or obj:IsA("CharacterMesh") or obj:IsA("BodyColors") then
\t\t\tobj:Destroy()
\t\tend
\tend

\tlocal head = character:FindFirstChild("Head")
\tif head then
\t\tfor _, obj in ipairs(head:GetChildren()) do
\t\t\tif (obj:IsA("Decal") and obj.Name == "face") or obj:IsA("SpecialMesh") then
\t\t\t\tobj:Destroy()
\t\t\tend
\t\tend
\tend
end

local function loadAndApplyAsset(character, assetId, assetType)
\tif not assetId or assetId == 0 or assetId == "" then return end
\t
\tlocal success, objects = pcall(function()
\t\treturn game:GetObjects("rbxassetid://" .. tostring(assetId))
\tend)
\t
\tif success and objects then
\t\tfor _, obj in ipairs(objects) do
\t\t\t-- Using Accoutrement catches Accessories, Hats, and legacy Hair
\t\t\tif obj:IsA("Accoutrement") then 
\t\t\t\tattachAccessory(character, obj)
\t\t\telseif obj:IsA("Shirt") or obj:IsA("Pants") or obj:IsA("ShirtGraphic") or obj:IsA("CharacterMesh") then
\t\t\t\tobj.Parent = character
\t\t\telseif assetType == "Face" then
\t\t\t\t-- Dig through folders in case the Decal is hidden inside
\t\t\t\tlocal decal = obj:IsA("Decal") and obj or obj:FindFirstChildWhichIsA("Decal", true)
\t\t\t\tlocal head = character:FindFirstChild("Head")
\t\t\t\tif head and decal then
\t\t\t\t\tfor _, v in ipairs(head:GetChildren()) do
\t\t\t\t\t\tif v:IsA("Decal") and v.Name == "face" then v:Destroy() end
\t\t\t\t\tend
\t\t\t\t\tdecal.Name = "face"
\t\t\t\t\tdecal.Parent = head
\t\t\t\tend
\t\t\telseif assetType == "Head" then
\t\t\t\tlocal mesh = obj:IsA("SpecialMesh") and obj or obj:FindFirstChildWhichIsA("SpecialMesh", true)
\t\t\t\tlocal head = character:FindFirstChild("Head")
\t\t\t\tif head and mesh then
\t\t\t\t\tfor _, v in ipairs(head:GetChildren()) do
\t\t\t\t\t\tif v:IsA("SpecialMesh") then v:Destroy() end
\t\t\t\t\tend
\t\t\t\t\tmesh.Parent = head
\t\t\t\tend
\t\t\tend
\t\tend
\tend
end

local function applyOutfit(outfitId)
\tlocal character = localPlayer.Character or localPlayer.CharacterAdded:Wait()
\t
\tlocal success, description = pcall(function()
\t\treturn Players:GetHumanoidDescriptionFromOutfitId(outfitId)
\tend)
\t
\tif not success or not description then
\t\twarn("Failed to fetch HumanoidDescription for outfit")
\t\treturn
\tend

\tclearAppearance(character)
\t
\t-- Apply Colors
\tlocal bc = Instance.new("BodyColors")
\tbc.HeadColor3 = description.HeadColor
\tbc.LeftArmColor3 = description.LeftArmColor
\tbc.RightArmColor3 = description.RightArmColor
\tbc.LeftLegColor3 = description.LeftLegColor
\tbc.RightLegColor3 = description.RightLegColor
\tbc.TorsoColor3 = description.TorsoColor
\tbc.Parent = character

\t-- Recreate Default Head Mesh
\tlocal head = character:FindFirstChild("Head")
\tif head then
\t\tlocal mesh = Instance.new("SpecialMesh")
\t\tmesh.MeshType = Enum.MeshType.Head
\t\tmesh.Scale = Vector3.new(1.25, 1.25, 1.25)
\t\tmesh.Parent = head
\tend

\t-- Load standard clothing
\tloadAndApplyAsset(character, description.Shirt, "Shirt")
\tloadAndApplyAsset(character, description.Pants, "Pants")
\tloadAndApplyAsset(character, description.GraphicTShirt, "ShirtGraphic")
\t
\t-- Load Custom Faces or Default
\tif description.Face > 0 then
\t\tloadAndApplyAsset(character, description.Face, "Face")
\telseif head then
\t\tlocal defaultFace = Instance.new("Decal")
\t\tdefaultFace.Name = "face"
\t\tdefaultFace.Texture = "rbxasset://textures/face.png"
\t\tdefaultFace.Parent = head
\tend

\t-- Load Custom Heads
\tif description.Head > 0 then
\t\tloadAndApplyAsset(character, description.Head, "Head")
\tend

\t-- Load Body Bundles (Applies CharacterMeshes)
\tlocal bodyParts = {"LeftArm", "RightArm", "LeftLeg", "RightLeg", "Torso"}
\tfor _, partName in ipairs(bodyParts) do
\t\tif description[partName] and description[partName] ~= 0 then
\t\t\tloadAndApplyAsset(character, description[partName], "Body")
\t\tend
\tend
\t
\t-- Load & attach all accessories (Including Hair)
\tlocal accessoryProps = {
\t\t"HatAccessory", "HairAccessory", "FaceAccessory", "NeckAccessory",
\t\t"ShouldersAccessory", "FrontAccessory", "BackAccessory", "WaistAccessory"
\t}
\t
\tfor _, prop in ipairs(accessoryProps) do
\t\tlocal idsString = description[prop]
\t\tif idsString and idsString ~= "" then
\t\t\tfor idStr in string.gmatch(idsString, "([^,]+)") do
\t\t\t\tlocal id = tonumber(idStr)
\t\t\t\tif id then
\t\t\t\t\tloadAndApplyAsset(character, id, "Accessory")
\t\t\t\tend
\t\t\tend
\t\tend
\tend
end

applyOutfit(targetOutfitId)

_G.__AppearanceConnection = localPlayer.CharacterAdded:Connect(function(character)
\tcharacter:WaitForChild("Humanoid")
\tcharacter:WaitForChild("HumanoidRootPart")
\tapplyOutfit(targetOutfitId)
end)`;

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
