document.addEventListener('DOMContentLoaded', async () => {
    await load();
    clicks();
});

async function load() {
    const data = await chrome.storage.local.get(['trackingData', 'currentMood']);
    const info = data.trackingData || {
        totalTime: 0,
        currentSite: 'None',
        sitesVisited: []
    };
    const mood = data.currentMood || 'neutral';
    display(info, mood);
}

function display(info, mood) {
    const img = document.querySelector('.catimg');
    const moodtext = document.getElementById('mood');
    
    img.src = 'art/neutral.gif';
    img.onerror = () => {
        img.style.background = '#ddd';
        img.alt = 'missing';
    };
    
    moodtext.textContent = upper(mood);
    document.getElementById('time').textContent = formattime(info.totalTime);
    document.getElementById('site').textContent = info.currentSite || 'None';
    document.getElementById('count').textContent = info.sitesVisited.length;
}

function clicks() {
    const img = document.querySelector('.catimg');
    const feelings = ['sad', 'grumpy', 'neutral', 'content', 'happy', 'overjoyed'];
    let idx = 0;
    
    img.onclick = () => {
        idx = (idx + 1) % feelings.length;
        const feeling = feelings[idx];
        document.getElementById('mood').textContent = upper(feeling);
        chrome.storage.local.set({ currentMood: feeling });
    };
}

function formattime(s) {
    if (s < 60) {
        return s + 's';
    } else if (s < 3600) {
        const m = Math.floor(s / 60);
        const r = s % 60;
        return m + 'm ' + r + 's';
    } else {
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        return h + 'h ' + m + 'm';
    }
}

function upper(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
}