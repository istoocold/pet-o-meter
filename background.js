let info = {
    totalTime: 0,
    currentSite: 'None',
    sitesVisited: [],
    sessionStart: Date.now(),
    lastActiveTime: Date.now()
};
let currenttab = null;
let interval = null;

chrome.runtime.onStartup.addListener(start);
chrome.runtime.onInstalled.addListener(start);

async function start() {
    const saved = await chrome.storage.local.get(['trackingData']);
    if (saved.trackingData) {
        info = { ...info, ...saved.trackingData };
        info.sessionStart = Date.now();
    }
    await refresh();
    tick();
}

chrome.tabs.onActivated.addListener(async (active) => {
    currenttab = active.tabId;
    await refresh();
});

chrome.tabs.onUpdated.addListener(async (id, change, tab) => {
    if (id === currenttab && change.status === 'complete') {
        await refresh();
    }
});

async function refresh() {
    try {
        if (!currenttab) {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs.length > 0) {
                currenttab = tabs[0].id;
            }
        }
        
        if (currenttab) {
            const tab = await chrome.tabs.get(currenttab);
            if (tab && tab.url && !tab.url.startsWith('chrome://')) {
                const site = getsite(tab.url);
                info.currentSite = site;
                
                if (!info.sitesVisited.includes(site)) {
                    info.sitesVisited.push(site);
                }
                
                info.lastActiveTime = Date.now();
                await store();
            }
        }
    } catch (e) {
        console.log('err:', e);
    }
}

function getsite(url) {
    try {
        const link = new URL(url);
        return link.hostname.replace('www.', '');
    } catch (e) {
        return 'unknown';
    }
}

function tick() {
    if (interval) {
        clearInterval(interval);
    }
    
    interval = setInterval(async () => {
        const now = Date.now();
        const gap = now - info.lastActiveTime;
        
        if (gap < 30000) {
            info.totalTime += 1;
            if (info.totalTime % 10 === 0) {
                await store();
            }
        }
    }, 1000);
}

async function store() {
    try {
        await chrome.storage.local.set({ trackingData: info });
    } catch (e) {
        console.log('store err:', e);
    }
}

chrome.tabs.onActivated.addListener(() => {
    info.lastActiveTime = Date.now();
});

chrome.tabs.onUpdated.addListener(() => {
    info.lastActiveTime = Date.now();
});