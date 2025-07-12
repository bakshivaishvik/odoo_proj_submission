document.addEventListener('DOMContentLoaded', function () {
    document
        .getElementById('prompt')
        .focus();
    document.getElementById('mm-fit').addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (window.markmapInstance) {
            window.markmapInstance.fit();
        }
    });
});

let currentMarkdown = '';
let currentMindmapTitle = '';
let currentMindmap = {
    topic: '',
    markdown: '',
    timestamp: null
};

function updateCurrentMindmap() {
    const markdown = document
        .getElementById('mindmap')
        .getAttribute('data-markdown') || '';
    currentMindmap = {
        topic: currentMindmapTitle,
        markdown: markdown,
        timestamp: new Date().toISOString()
    };
}

function closeShareDialog() {
    const overlay = document.querySelector('.overlay');
    const dialog = document.querySelector('.share-dialog');
    if (overlay) 
        overlay.remove();
    if (dialog) 
        dialog.remove();
}

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0,
            v = c == 'x'
                ? r
                : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

async function shareMindmap() {
    if (document.querySelector('.share-dialog')) {
        return; 
    }
    
    const shareButton = document.querySelector('.share-button');
    if (shareButton) {
        shareButton.disabled = true;
        shareButton.style.opacity = '0.5';
    }

    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.style.display = 'block';

    const dialog = document.createElement('div');
    dialog.className = 'share-dialog';
    dialog.innerHTML = `
        <h3>Share Mind Map</h3>
        <p>Generating share link...</p>
        <div class="loading-spinner"></div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(dialog);
        
    try {
        updateCurrentMindmap();
        if (!currentMindmap.markdown) {
            throw new Error('No mind map content available to share');
        }
        const response = await fetch('https://share.mindmapwizard.com/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(
                {topic: currentMindmap.topic, markdown: currentMindmap.markdown, timestamp: new Date().toISOString()}
            )
        });

        if (!response.ok) {
            let errorData = { message: `Failed to share mindmap. Status: ${response.status}` };
            try {
                errorData = await response.json();
            } catch (e) {
                console.error("Failed to parse error response JSON:", e);
            }
            throw new Error(errorData.message || `Failed to share mindmap. Status: ${response.status}`);
        }

        const data = await response.json();

        if (window.dataLayer) {
            window.dataLayer.push({'event': 'mindmap_share_success', 'action': 'Share Success'});
        }

        const shareUrl = `${window.location.origin}/view.html?id=${data.id}`;

        dialog.innerHTML = `
            <div id="dialog-qr-code-container" style="margin: 20px auto; width: 128px; height: 128px;" class="qr-code-container"></div>
            <hr style="border: 1.5px solid; border-color: #E2E8F0; border-radius: 5px; margin: 10px 0 10px 0;" class="qr-code-container-hr">
            <h3>Share Mind Map</h3>
            <p>Scan the qr code or copy this link to share your mind map.</p>
            <input type="text" class="share-link" value="${shareUrl}" readonly>
            <div class="dialog-buttons">
                <button class="dialog-button cancel" onclick="closeShareDialog()">Close</button>
                <button class="dialog-button confirm" onclick="copyShareLink()">Copy Link</button>
            </div>
        `;
        
        const qrCodeContainerInDialog = dialog.querySelector("#dialog-qr-code-container");
        
        if (qrCodeContainerInDialog) {
            new QRCode(qrCodeContainerInDialog, {
                text: shareUrl,
                width: 128,
                height: 128,
                colorDark : "#000000",
                colorLight : "#ffffff",
                correctLevel : QRCode.CorrectLevel.H
            });
        } else {
            console.error("QR code container '#dialog-qr-code-container' not found in dialog.");
            dialog.innerHTML += '<p style="color: red; text-align: center;">Error: Could not display QR code.</p>';
        }

    } catch (error) {
        console.error('Error sharing mindmap:', error);
        dialog.innerHTML = `
            <h3>Share Mindmap</h3>
            <p style="color: red;">${error.message || 'Failed to share mindmap. Please try again.'}</p>
            <div class="dialog-buttons">
                <button class="dialog-button cancel" onclick="closeShareDialog()">Close</button>
            </div>
        `;

        if (window.dataLayer) {
            window.dataLayer.push({'event': 'mindmap_share_error', 'action': 'Share Failed'});
        }
    } finally {
        if (shareButton) {
            shareButton.disabled = false;
            shareButton.style.opacity = '1';
        }
    }
}

function copyShareLink() {
    const shareLink = document.querySelector('.share-link');
    shareLink.select();
    document.execCommand('copy');

    if (window.dataLayer) {
        window
            .dataLayer
            .push(
                {'event': 'mindmap_share_link_copy', 'mindmap_category': 'User Interaction', 'mindmap_action': 'Copy Share Link'}
            );
    }
}

function formatMarkdown(text) {
    if (!text) {
        console.error("Received empty response from API");
        return { topic: "Mind Map", markdown: "# Mind Map\n\nError: No content received" };
    }
    
    if (typeof text === 'object' && text.topic && text.raw) {
        return {
            topic: text.topic,
            markdown: text.raw.trim().replace(/\n\s*\n/g, '\n\n').replace(/```/g, '').replace(/(?<!\n)(?<!\#)(\s*#)/g, '\n$1')
        };
    }
    
    text = String(text);
    
    const topicMatch = text.match(/topic="([^"]+)"/);
    const markdownMatch = text.match(/markdown="([^"]+)"/);

    if (topicMatch && markdownMatch) {
        const topic = topicMatch[1];
        let markdown = markdownMatch[1];

        markdown = markdown
            .replace(/\\n/g, '\n')
            .trim()
            .replace(/\n\s*\n/g, '\n\n')
            .replace(/```/g, '')
            .replace(/(?<!\n)(?<!\#)(\s*#)/g, '\n$1');

        return {topic, markdown};
    } else {
        const firstHeadingMatch = text.match(/^#\s+(.+)$/m);
        const topic = firstHeadingMatch ? firstHeadingMatch[1] : "Mind Map";
        
        const markdown = text
            .trim()
            .replace(/\n\s*\n/g, '\n\n')
            .replace(/```/g, '')
            .replace(/(?<!\n)(?<!\#)(\s*#)/g, '\n$1');
        
        return {topic, markdown};
    }
}

function generateMindmap(mindmapTopic, isRegenerate = false) {
    if (!mindmapTopic)
        return;
    
    if (!isRegenerate) {
        document
            .getElementById("header")
            .style
            .display = "none";
        document
            .getElementById("recent-mindmaps")
            .style
            .display = "none";
        document
            .getElementById("ai-content-disclaimer")
            .style
            .display = "block";
        document
            .getElementById("mindmap")
            .style
            .display = "none";
    }
    
    document
        .getElementById("loading-animation")
        .style
        .display = "flex";
    
    if (isRegenerate) {
        const regenerateBtn = document.getElementById('regenerate-button');
        regenerateBtn
            .classList
            .add('rotating');
    }
    
    currentMindmapTitle = mindmapTopic;
    
    document
        .getElementById("mindmap")
        .style
        .display = "block";
    
    fetch('https://generate.mindmapwizard.com', {
        method: 'POST',
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({input: mindmapTopic})
    })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                showErrorPopup(data.error);
                return;
            }

            const responseData = data.response || data;
            const {topic, markdown} = formatMarkdown(responseData);
                        
            if (markdown) {
                renderMindmap(markdown);
                currentMindmapTitle = topic || mindmapTopic;
                
                if (window.dataLayer) {
                    window
                        .dataLayer
                        .push({
                            'event': 'mindmap_generated',
                            'mindmap_type': isRegenerate
                                ? 'regenerated'
                                : 'new'
                        });
                }
            }
                
            document
                .getElementById("loading-animation")
                .style
                .display = "none";
                
            document
                .getElementById("button-container")
                .style
                .display = "flex";
                
            if (isRegenerate) {
                const regenerateBtn = document.getElementById('regenerate-button');
                regenerateBtn
                    .classList
                    .remove('rotating');
            }
        })
        .catch(error => {
            console.error("Error generating the mindmap:", error);
            showErrorPopup("An error occurred while generating the mindmap");
            
            document
                .getElementById("loading-animation")
                .style
                .display = "none";
            
            if (isRegenerate) {
                const regenerateBtn = document.getElementById('regenerate-button');
                regenerateBtn
                    .classList
                    .remove('rotating');
            }
        });
}

function showErrorPopup(errorMessage) {
    let errorPopup = document.getElementById('error-popup');
    
    if (!errorPopup) {
        errorPopup = document.createElement('div');
        errorPopup.id = 'error-popup';
        errorPopup.style.position = 'fixed';
        errorPopup.style.top = '50%';
        errorPopup.style.left = '50%';
        errorPopup.style.transform = 'translate(-50%, -50%)';
        errorPopup.style.backgroundColor = 'white';
        errorPopup.style.padding = '20px';
        errorPopup.style.borderRadius = '20px';
        errorPopup.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.05)';
        errorPopup.style.zIndex = '1000';
        errorPopup.style.maxWidth = '400px';
        errorPopup.style.textAlign = 'center';
        
        document.body.appendChild(errorPopup);
    }
    
    errorPopup.innerHTML = `
        <h3 style="color: #1e293b; margin-top: 0;">Error</h3>
                <p>An error occurred. Please try again later.</p>
                <br>
                <br>
        <p>${errorMessage}</p>
        <button id="close-error-popup" style="background-color:rgb(255, 83, 80); color: white; border: none; padding: 8px 16px; border-radius: 40px; cursor: pointer; margin-top: 10px;">Close</button>
    `;
    
    errorPopup.style.display = 'block';
    
    document.getElementById('close-error-popup').addEventListener('click', function() {
        errorPopup.style.display = 'none';
    });
    
    document
        .getElementById("loading-animation")
        .style
        .display = "none";
        
    if (document.getElementById('regenerate-button')) {
        document
            .getElementById('regenerate-button')
            .classList
            .remove('rotating');
    }
}

function renderMindmap(markdown) {
    currentMarkdown = markdown;
    const mindmapContainer = document.getElementById('mindmap');
    mindmapContainer.setAttribute('data-markdown', markdown);
    mindmapContainer.innerHTML = "";
    try {
        if (!markdown || typeof markdown !== 'string') {
            throw new Error("Invalid markdown input");
        }

        if (!markdown.trim().startsWith('#')) {
            markdown = '# ' + markdown;
        }

        mindmapContainer.style.position = 'fixed';
        mindmapContainer.style.top = '0';
        mindmapContainer.style.left = '0';
        mindmapContainer.style.width = '100vw';
        mindmapContainer.style.height = '100vh';
        mindmapContainer.style.display = 'block';

        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        mindmapContainer.appendChild(svg);

        const {Markmap, Transformer} = window.markmap;
        const transformer = new Transformer();

        if (!markdown.startsWith('---\nmarkmap:')) {
            markdown = '---\nmarkmap:\n  maxWidth: 500\n---\n\n' + markdown;
        }

        const {root} = transformer.transform(markdown);

        const mm = Markmap.create(svg, {
            autoFit: true,
            duration: 500,
            maxWidth: 550,
            zoom: true,
            pan: true
        }, root);

        mm.fit();
        
        window.markmapInstance = mm;

    } catch (error) {
        console.error('Mindmap Error:', error);
        const errorMessage = document.createElement('div');
        errorMessage.textContent = "Error rendering the mindmap: " + error.message;
        errorMessage.style.color = 'var(--error-color)';
        mindmapContainer.appendChild(errorMessage);
    }
}

const DownloadHandler = {
    getMindmapElements() {
        const container = document.getElementById('mindmap');
        const svg = container
            ?.querySelector('svg');
        const topic = currentMindmapTitle || 'mindmap';

        if (!svg || container.children.length === 0) {
            throw new Error("No mind map available to download.");
        }

        return {svg, topic};
    },

    getSVGData(svg, padding = 30) {
        const bbox = svg.getBBox();
        const width = bbox.width + (padding * 2);
        const height = bbox.height + (padding * 2);

        const svgCopy = svg.cloneNode(true);
        svgCopy.setAttribute('width', width);
        svgCopy.setAttribute('height', height);
        svgCopy.setAttribute(
            'viewBox',
            `${bbox.x - padding} ${bbox.y - padding} ${width} ${height}`
        );

        const svgContent = new XMLSerializer().serializeToString(svgCopy);

        return {svgContent, width, height};
    },

    triggerDownload(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document
            .body
            .appendChild(link);
        link.click();
        document
            .body
            .removeChild(link);
        URL.revokeObjectURL(url);
    },

    downloadMarkdown(topic) {
        const blob = new Blob([currentMarkdown], {type: 'text/markdown'});
        this.triggerDownload(blob, `${topic}.md`);
    },

    downloadSVG(svgContent, topic) {
        const blob = new Blob([svgContent], {type: "image/svg+xml;charset=utf-8"});
        this.triggerDownload(blob, `${topic}.svg`);
    },

    downloadPDF(svgContent, width, height, topic) {
        const tempSvg = document.createElement('div');
        tempSvg.innerHTML = svgContent;
        const svgElement = tempSvg.firstElementChild;
        const svgData = new XMLSerializer().serializeToString(svgElement);

        const scale = 1.8;
        const canvas = document.createElement('canvas');
        canvas.width = width * scale;
        canvas.height = height * scale;
        const ctx = canvas.getContext('2d');

        const img = new Image();
        img.crossOrigin = 'Anonymous';

        img.onload = () => {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.scale(scale, scale);
            ctx.drawImage(img, 0, 0);

            const pdf = new jsPDF({
                orientation: width > height
                    ? 'landscape'
                    : 'portrait',
                unit: 'pt',
                format: 'letter'
            });

            const pdfWidth = pdf
                .internal
                .pageSize
                .getWidth();
            const pdfHeight = pdf
                .internal
                .pageSize
                .getHeight();

            const pdfAspectRatio = pdfWidth / pdfHeight;
            const imageAspectRatio = width / height;
            let finalWidth = pdfWidth;
            let finalHeight = pdfHeight;

            if (imageAspectRatio > pdfAspectRatio) {
                finalHeight = pdfWidth / imageAspectRatio;
            } else {
                finalWidth = pdfHeight * imageAspectRatio;
            }

            const xOffset = (pdfWidth - finalWidth) / 2;
            const yOffset = (pdfHeight - finalHeight) / 2;

            pdf.addImage(
                canvas.toDataURL('image/jpeg', 1.0),
                'JPEG',
                xOffset,
                yOffset,
                finalWidth,
                finalHeight
            );

            pdf.save(`${topic}.pdf`);
            canvas.remove();
        };

        img.src = 'data:image/svg+xml;base64,' + btoa(
            unescape(encodeURIComponent(svgData))
        );
    },

    downloadJPG(svg, topic) {
        const {svgContent, width, height} = this.getSVGData(svg);
        const tempSvg = document.createElement('div');
        tempSvg.innerHTML = svgContent;
        const svgElement = tempSvg.firstElementChild;
        const svgData = new XMLSerializer().serializeToString(svgElement);

        const scale = 2.0;
        const canvas = document.createElement('canvas');
        canvas.width = width * scale;
        canvas.height = height * scale;
        const ctx = canvas.getContext('2d');

        const img = new Image();
        img.crossOrigin = 'Anonymous';

        img.onload = () => {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.scale(scale, scale);
            ctx.drawImage(img, 0, 0);
            this.triggerDownload(
                this.dataURLToBlob(canvas.toDataURL('image/jpeg', 1.0)),
                `${topic}.jpg`
            );
            canvas.remove();
        };

        img.src = 'data:image/svg+xml;base64,' + btoa(
            unescape(encodeURIComponent(svgData))
        );
    },

    dataURLToBlob(dataURL) {
        const arr = dataURL.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], {type: mime});
    }
};

window.jsPDF = window.jspdf.jsPDF;

function downloadMindmap(format) {
    try {
        const {svg, topic} = DownloadHandler.getMindmapElements();

        if (format === 'markdown') {
            DownloadHandler.downloadMarkdown(topic);
            return;
        }

        const {svgContent, width, height} = DownloadHandler.getSVGData(svg);

        switch (format) {
            case 'svg':
                DownloadHandler.downloadSVG(svgContent, topic);
                break;
            case 'pdf':
                DownloadHandler.downloadPDF(svgContent, width, height, topic);
                break;
            case 'jpg':
                DownloadHandler.downloadJPG(svg, topic);
                break;
            default:
                throw new Error(`Unsupported format: ${format}`);
        }

        document
            .getElementById('download-options-popup')
            .style
            .display = 'none';
    } catch (error) {
        console.error('Download error:', error);
        alert(error.message);
    }
}

document.addEventListener('DOMContentLoaded', function () {
    const downloadBtn = document.getElementById('download-btn');
    const formatSelect = document.getElementById('download-format');

    downloadBtn.addEventListener('click', function () {
        const format = formatSelect.value;
        downloadMindmap(format);
    });
});

function downloadAsImage() {
    try {
        const {svg, topic} = DownloadHandler.getMindmapElements();
        DownloadHandler.downloadJPG(svg, topic);
    } catch (error) {
        console.error('Download error:', error);
        alert(error.message);
    }
}
const downloadBtn = document.getElementById('download-mindmap-btn');
const popup = document.getElementById('download-options-popup');
const closeBtn = document.getElementById('close-download-options-popup');
const prompt = document.getElementById('prompt');
const regenerateBtn = document.getElementById('regenerate-button');
const generateBtn = document.getElementById('generate-mindmap-btn');
const editModeButton = document.getElementById('edit-mode-button');
const cancelEditButton = document.getElementById('cancel-edit');
const saveEditButton = document.getElementById('save-edit');

editModeButton.addEventListener('click', () => toggleEditMode(true));
cancelEditButton.addEventListener('click', () => toggleEditMode(false));
saveEditButton.addEventListener('click', updateMindmapFromEdit);

generateBtn.addEventListener('click', function () {
    const mindmapTopic = prompt
        .value
        .trim();
    if (mindmapTopic) {
        generateMindmap(mindmapTopic);
    }
});

regenerateBtn.addEventListener('click', function () {
    console.log('Regenerate-Button clicked!');

    if (!currentMindmapTitle) {
        console.error("No topic available to regenerate the mindmap.");
        return;
    }
    generateMindmap(currentMindmapTitle, true);
});

downloadBtn.addEventListener('click', function () {
    popup.style.display = 'block';
});

closeBtn.addEventListener('click', function () {
    popup.style.display = 'none';
});

popup.addEventListener('click', function (event) {
    if (event.target === popup) {
        popup.style.display = 'none';
    }
});

const mindmapTopic = document.getElementById('hehehe').textContent;
console.log(mindmapTopic);
if (mindmapTopic) {
    generateMindmap(mindmapTopic);
}

document
    .getElementById('download-mindmap-btn')
    .onclick = function () {
        document
            .getElementById('download-options-popup')
            .style
            .display = 'block';
    }

document
    .getElementById('download-options-popup')
    .onclick = function (event) {
        if (event.target === this) {
            document
                .getElementById('download-options-popup')
                .style
                .display = 'none';
        }
    }

document
    .getElementById('close-download-options-popup')
    .onclick = function () {
        document
            .getElementById('download-options-popup')
            .style
            .display = 'none';
    }

window.onclick = function (event) {
    const popup = document.getElementById('download-options-popup');
    if (event.target === popup) {
        popup.style.display = 'none';
    }
}

function getQueryParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return decodeURIComponent(urlParams.get(name) || '');
}

prompt.addEventListener('keypress', function (event) {
    if (event.key === 'Enter') {
        const mindmapTopic = prompt
            .value
            .trim();
        if (mindmapTopic) {
            generateMindmap(mindmapTopic);
        }
    }

    const mindmapTopic = getQueryParameter('q');
    if (mindmapTopic) {
        generateMindmap(mindmapTopic);
    }
});

document
    .getElementById('download-mindmap-btn')
    .onclick = function () {
        document
            .getElementById('download-options-popup')
            .style
            .display = 'block';
    }
document
    .getElementById('download-options-popup')
    .onclick = function (event) {
        if (event.target === this) {
            document
                .getElementById('download-options-popup')
                .style
                .display = 'none';
        }
    }

document
    .getElementById('close-download-options-popup')
    .onclick = function () {
        document
            .getElementById('download-options-popup')
            .style
            .display = 'none';
    }

window.onclick = function (event) {
    const popup = document.getElementById('download-options-popup');
    if (event.target === popup) {
        popup.style.display = 'none';
    }
}

function downloadAsImage() {
    const mindmapContainer = document.getElementById('mindmap');
    const svg = mindmapContainer.querySelector('svg');

    if (!svg) {
        alert("No mind map available to export.");
        return;
    }

    const svgCopy = svg.cloneNode(true);

    const bbox = svg.getBBox();
    const padding = 20;

    const width = bbox.width + (padding * 2);
    const height = bbox.height + (padding * 2);

    svgCopy.setAttribute(
        'viewBox',
        `${bbox.x - padding} ${bbox.y - padding} ${width} ${height}`
    );
    svgCopy.setAttribute('width', width);
    svgCopy.setAttribute('height', height);

    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svgCopy);
    const svgBase64 = btoa(unescape(encodeURIComponent(svgStr)));
    const dataUrl = `data:image/svg+xml;base64,${svgBase64}`;

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = function () {
        const scale = 1.8;
        const canvas = document.createElement('canvas');
        canvas.width = this.width * scale;
        canvas.height = this.height * scale;

        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0);

        const url = canvas.toDataURL('image/png', 1.0);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'mindmap.png';
        a.click();
    };

    img.src = dataUrl;
    document
        .getElementById('download-options-popup')
        .style
        .display = 'none';
}

function toggleEditMode(show) {
    const mindmapElement = document.getElementById('mindmap');
    const editorElement = document.getElementById('markdown-editor');
    const textarea = document.getElementById('markdown-textarea');
    const editorOverlay = document.getElementById('editor-overlay');

    if (show) {
        mindmapElement.style.display = 'none';
        editorElement.style.display = 'block';
        editorOverlay.style.display = 'block';
        textarea.value = currentMarkdown;
        textarea.focus();
    } else {
        mindmapElement.style.display = 'block';
        editorElement.style.display = 'none';
        editorOverlay.style.display = 'none';
    }
}

function updateMindmapFromEdit() {
    const textarea = document.getElementById('markdown-textarea');
    const newMarkdown = textarea.value;

    if (newMarkdown !== currentMarkdown) {
        currentMarkdown = newMarkdown;
        renderMindmap(currentMarkdown);
    }

    toggleEditMode(false);
}

function copyShareLink() {
    const input = document.querySelector('.share-link');
    input.select();
    document.execCommand('copy');
}

function closeShareDialog() {
    const dialog = document.querySelector('.share-dialog');
    const overlay = document.querySelector('.overlay');
    if (dialog) 
        dialog.remove();
    if (overlay) 
        overlay.remove();
    }
    
const infoButton = document.querySelector('.info-button');
if (infoButton) {
    infoButton.addEventListener('click', function (e) {
        e.preventDefault();
        const infoMenu = document.querySelector('.info-menu');
        if (infoMenu) {
            infoMenu.classList.toggle('show');
        }
    });
}

if (localStorage.getItem('hasRated')) {
    console.log('User has already rated');
} else {
    setTimeout(() => {
        document
            .getElementById('ratingPopup')
            .classList
            .add('show');
    }, 50000);
}

function closeRatingPopup() {
    const popup = document.getElementById('ratingPopup');
    popup.style.opacity = '0';
    popup.style.transform = 'translateX(-50%) translateY(20px)';
    setTimeout(() => {
        popup
            .classList
            .remove('show');
        popup.style.opacity = '';
        popup.style.transform = '';
    }, 500);
}

document
    .querySelectorAll('.rating input')
    .forEach(input => {
        input.addEventListener('change', function () {
            const rating = this.value;
            const scriptURL = "https://post.mindmapwizard.com";
            const formData = new FormData();
            formData.set('rating', `${rating}/5`);
            formData.set('source', 'Mind Map Wizard - Rate us');

            fetch(scriptURL, {
                method: 'POST',
                body: formData
            })
                .then(response => {
                    localStorage.setItem('hasRated', 'true');
                    closeRatingPopup();
                })
                .catch(error => {
                    console.error('Error!', error.message);
                    alert('Sorry, there was an error submitting your rating.');
                });
        });
    });

    document.addEventListener('DOMContentLoaded', function () {
        
document.addEventListener('keydown', function(e) {
    const mindmapVisible = document.getElementById('mindmap').style.display === 'block';
    const isTyping = ['input', 'textarea'].includes(document.activeElement.tagName.toLowerCase());
    const hasMarkdown = currentMarkdown && currentMarkdown.trim().length > 0;
    
    if (mindmapVisible && !isTyping && hasMarkdown) {
        // Edit: E
        if (e.key === 'e') {
            e.preventDefault();
            document.getElementById('edit-mode-button').click();
        }
        
        // Download: D
        if (e.key === 'd') {
            e.preventDefault();
            document.getElementById('download-mindmap-btn').click();
        }
        
        // Regenerate: N
        if (e.key === 'g') {
            e.preventDefault();
            document.getElementById('regenerate-button').click();
        }
        
        // Share: S
        if (e.key === 's') {
            e.preventDefault();
            document.getElementById('share-btn').click();
        }

        if (e.key === 'f') {
            e.preventDefault();
            document.getElementById('mm-fit').click();
        }

    }
});
});

window.onload = function() {
    if (window.location.hostname === 'mind-map-wizard.pages.dev') {
        window.location.href = 'https://mindmapwizard.com' + window.location.pathname + window.location.search;
    }
};

const texts = [
    "Generate a Mind Map with AI",
    "Generate a Mind Map with AI",
    "Generate a Mind Map with AI",
    "Generate a Mind Map with AI",
    "What do you want to discover?",
    "What do you want to discover?",
    "What do you want to discover?",
    "Research Made Easy",
    "Get an Overview with AI",
    "Get the Full Picture"
];

function getRandomText() {
    const randomIndex = Math.floor(Math.random() * texts.length);
    return texts[randomIndex];
}

document.addEventListener("DOMContentLoaded", function() {
    const randomTextElement = document.getElementById("randomText");
    randomTextElement.textContent = getRandomText();
});