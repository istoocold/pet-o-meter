let data = {
    total: 0,
    curr: 'None',
    sites: [],
    start: Date.now(),
    lastact: Date.now(),
    act: [],
    cls: {}
};
let tab = null;
let timer = null;
let aitimer = null;

chrome.runtime.onStartup.addListener(init);
chrome.runtime.onInstalled.addListener(init); 

async function init() {
    const saved = await chrome.storage.local.get(['trackingData']);
    if (saved.trackingData) {
        data = { ...data, ...saved.trackingData };
        data.start = Date.now();
    }
    await upd();
    tick();
    aicheck();
}

chrome.tabs.onActivated.addListener(async (active) => {
    tab = active.tabId;
    data.lastact = Date.now();
    await upd();
});

chrome.tabs.onUpdated.addListener(async (id, change, t) => {
    if (id === tab && change.status === 'complete') {
        await upd();
    }
});

async function upd() {
    try {
        if (!tab) {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs.length > 0) tab = tabs[0].id;
        }
        
        if (tab) {
            const t = await chrome.tabs.get(tab);
            if (t && t.url && !t.url.startsWith('chrome://')) {
                const site = gethost(t.url);
                data.curr = site;
                
                if (!data.sites.includes(site)) {
                    data.sites.push(site);
                }
                
                track(site, t.url, t.title);
                data.lastact = Date.now();
                await save();
            }
        }
    } catch (e) {
        
    }
}


function gethost(url) {
    try {
        const u = new URL(url);
        return u.hostname.replace('www.', '');
    } catch (e) {
        return 'unknown';
    }
}

function tick() {
    if (timer) clearInterval(timer);
    
    timer = setInterval(async () => {
        const now = Date.now();
        const gap = now - data.lastact;
        
        if (gap < 30000 && data.curr !== 'None') {
            data.total += 1;
            track(data.curr);
            
            if (data.total % 10 === 0) {
                await save();
            }
        }
    }, 1000);
}

async function save() {
    try {
        await chrome.storage.local.set({ trackingData: data });
    } catch (e) {}
}

chrome.tabs.onActivated.addListener(() => {
    data.lastact = Date.now();
});

chrome.tabs.onUpdated.addListener(() => {
    data.lastact = Date.now();
});

chrome.windows.onFocusChanged.addListener(() => {
    data.lastact = Date.now();
});

function track(site, url = null, title = null) {
    const now = Date.now();
    const ex = data.act.find(a => a.site === site);
    
    if (ex) {
        ex.time += 1;
        ex.last = now;
        if (url) ex.lastUrl = url;
        if (title) ex.title = title;
    } else {
        data.act.push({
            site: site,
            time: 1,
            last: now,
            lastUrl: url || `https://${site}`,
            title: title
        });
    }
    
    data.act = data.act.filter(a => (now - a.last) < 3600000);
}

function aicheck() {
    aitimer = setInterval(async () => {
        try {
            const recent = data.act.filter(a => 
                (Date.now() - a.last) < 1800000 && a.time >= 15
            );
            
            if (recent.length > 0) {
                const needcls = recent.filter(site => 
                    !data.cls[site.site] || 
                    (Date.now() - data.cls[site.site].ts) > 3600000
                );
                
                if (needcls.length > 0) {
                    await classify(needcls);
                }
                
                const lvl = getlvl(recent);
                const mood = getmood(lvl);
                
                await chrome.storage.local.set({ 
                    currentMood: mood,
                    productivityLevel: lvl
                });
            }
        } catch (e) {}
    }, 120000);
}

async function classify(sites) {
    for (const s of sites) {
        try {
            const cls = await clssite(s);
            data.cls[s.site] = {
                level: cls,
                ts: Date.now(),
                url: s.lastUrl
            };
        } catch (e) {
            const fb = fallback(s.site);
            data.cls[s.site] = {
                level: fb,
                ts: Date.now(),
                url: s.lastUrl
            };
        }
    }
}

async function clssite(s) {
    try {
        const prompt = mkprompt(s);
        
        const sys = `You are a productivity classifier. Analyze the website and video content, then respond with EXACTLY this format:
website:level

Where level is:
1 = Low productivity (entertainment, gaming, fun videos, memes)
2 = Medium productivity (news, general information, mixed content)
3 = High productivity (educational, tutorials, documentation)

For YouTube videos, analyze the title, description, and category to determine if it's:
- Educational/Tutorial content (level 3)
- News/Information (level 2)
- Entertainment/Fun (level 1)

Examples:
youtube.com [Tutorial: Learn Python Programming]:3
youtube.com [Funny Cat Compilation]:1
youtube.com [Tech News Update]:2

Respond with ONLY the format "website:level", nothing else.`;

        const res = await fetch('https://ai.hackclub.com/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [
                    { role: 'system', content: sys },
                    { role: 'user', content: prompt }
                ]
            })
        });

        if (!res.ok) {
            return fallback(s.site);
        }

        const d = await res.json();
        const raw = d.choices?.[0]?.message?.content?.trim();
        
        const m = raw.match(/:([123])/);
        if (m) {
            return parseInt(m[1]);
        }
        
        return fallback(s.site);
        
    } catch (e) {
        return fallback(s.site);
    }
}

function mkprompt(s) {
    const site = s.site;
    const url = s.lastUrl || `https://${site}`;
    const title = s.title || '';
    
    if (site.includes('youtube.com')) {
        try {
            const vurl = new URL(url);
            const vid = vurl.searchParams.get('v');
            const plist = vurl.searchParams.get('list');
            
            let p = `Website: youtube.com\nType: video\n`;
            
            if (title) {
                p += `Title: ${title}\n`;
            }
            
            if (vid) {
                p += `Video ID: ${vid}\n`;
            }
            
            if (plist) {
                p += `Playlist ID: ${plist}\n`;
            }
            
            p += `URL: ${url}`;
            return p;
            
        } catch (e) {
            return `Website: ${site}\nTitle: ${title}\nURL: ${url}`;
        }
    }
    
    if (site.includes('vimeo') || site.includes('twitch')) {
        return `Website: ${site}\nType: video\nTitle: ${title}\nURL: ${url}`;
    }
    
    return `Website: ${site}\nTitle: ${title}`;
}


function getlvl(recent) {
    let tot = 0;
    let wsum = 0;
    
    for (const s of recent) {
        const c = data.cls[s.site];
        const lvl = c ? c.level : fallback(s.site);
        const t = s.time;
        
        tot += t;
        wsum += lvl * t;
    }
    
    if (tot === 0) return 2;
    
    const avg = wsum / tot;
    
    if (avg <= 1.4) return 1;
    if (avg <= 2.4) return 2;
    return 3;
}

function fallback(site) {
    const sl = site.toLowerCase();
    
    const work = ['github', 'gitlab', 'stackoverflow', 'docs.', 'developer.', 'api.', 'code', 'learn', 'coursera', 'udemy', 'khanacademy', 'edx', 'pluralsight'];
    for (const w of work) {
        if (sl.includes(w)) return 3;
    }
    
    const fun = ['youtube', 'facebook', 'twitter', 'instagram', 'tiktok', 'reddit', 'netflix', 'twitch', 'game', 'entertainment', 'meme'];
    for (const f of fun) {
        if (sl.includes(f)) return 1;
    }
    
    return 2;
}

function getmood(lvl) {
    const map = {
        1: ['sad', 'grumpy'],
        2: ['neutral', 'content'],
        3: ['happy', 'overjoyed']
    };
    
    const opts = map[lvl] || map[2];
    return opts[Math.floor(Math.random() * opts.length)];
}

