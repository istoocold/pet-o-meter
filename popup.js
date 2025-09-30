document.addEventListener('DOMContentLoaded', async () => {
    await load();
    
    const row = document.getElementById('sites-row');
    const dd = document.getElementById('sites-dropdown');
    
    if (row && dd) {
        row.addEventListener('click', () => {
            dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
        });
    }
    
    setInterval(async () => {
        await load();
    }, 5000);
});

let lastm = null;

async function load() {
    const d = await chrome.storage.local.get(['trackingData', 'currentMood', 'productivityLevel', 'currentQuote', 'lastQuoteMood']);
    const info = d.trackingData || {
        total: 0,
        curr: 'None',
        sites: []
    };
    const mood = d.currentMood || 'neutral';
    const lvl = d.productivityLevel || 2;
    let quote = d.currentQuote || '';
    const lastqm = d.lastQuoteMood || null;
    
    if ((lastqm !== mood) || !quote) {
        quote = await genquote(mood, lvl);
    }
    
    show(info, mood, lvl, quote);
}

async function genquote(mood, lvl) {
    const qel = document.getElementById('quote');
    if (qel) {
        qel.textContent = 'THINKING...';
        qel.classList.add('loading');
    }
    
    try {
        let prompt = '';
        if (lvl === 1) {
            prompt = 'Generate a short motivational quote (max 10 words) for someone wasting time on social media. OUTPUT ONLY THE QUOTE.';
        } else if (lvl === 2) {
            prompt = 'Generate a short encouraging quote (max 10 words) for someone with medium productivity. OUTPUT ONLY THE QUOTE.';
        } else {
            prompt = 'Generate a short celebratory quote (max 10 words) for someone being very productive. OUTPUT ONLY THE QUOTE.';
        }
        
        const res = await fetch('https://ai.hackclub.com/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [
                    {
                        role: 'system',
                        content: 'You are a quote generator for a Chrome extension. The extension is a PROGRAM that can ONLY display text. You MUST respond with ONLY the quote itself - no explanations, no thinking, no extra words. The quote must be 10 words or less. Do NOT use <think> tags or any other formatting. Just output the raw quote text.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ]
            })
        });
        
        if (!res.ok) {
            throw new Error(`API error: ${res.status}`);
        }
        
        const data = await res.json();
        
        let q = data.choices?.[0]?.message?.content?.trim();
        
        if (q) {
            q = q.replace(/<think>[\s\S]*?<\/think>/gi, '');
            q = q.replace(/<[^>]+>/g, '');
            q = q.replace(/^["']|["']$/g, '');
            q = q.trim();
            
            if (!q || q.length < 3) {
                throw new Error('Quote cleaned to nothing');
            }
            
            if (q.length > 80) {
                q = q.substring(0, 77) + '...';
            }
            
            await chrome.storage.local.set({ 
                currentQuote: q,
                lastQuoteMood: mood
            });
            
            if (qel) {
                qel.textContent = q.toUpperCase();
                qel.classList.remove('loading');
            }
            
            return q;
        } else {
            throw new Error('No quote in response');
        }
        
    } catch (e) {
        const fb = getfb(mood);
        
        await chrome.storage.local.set({ 
            currentQuote: fb,
            lastQuoteMood: mood
        });
        
        if (qel) {
            qel.textContent = fb;
            qel.classList.remove('loading');
        }
        
        return fb;
    }
}

function getfb(mood) {
    const fb = {
        'sad': 'TIME TO GET BACK TO WORK',
        'grumpy': 'FOCUS. YOU CAN DO BETTER',
        'neutral': 'KEEP GOING. STAY FOCUSED',
        'content': 'GOOD PROGRESS. MAINTAIN PACE',
        'happy': 'EXCELLENT WORK. KEEP IT UP',
        'overjoyed': 'MAXIMUM PRODUCTIVITY ACHIEVED'
    };
    
    return fb[mood] || 'STAY FOCUSED';
}

function show(info, mood, lvl, quote) {
    const img = document.querySelector('.catimg');
    const mtxt = document.getElementById('mood');
    const emoji = document.getElementById('emoji');
    const qel = document.getElementById('quote');
    
    let gif = 'neutral.gif';
    let sym = '█';
    
    if (lvl === 1 || mood === 'sad' || mood === 'grumpy') {
        gif = 'sad.gif';
        sym = mood === 'sad' ? '▼' : '✕';
    } else if (lvl === 3 || mood === 'happy' || mood === 'overjoyed') {
        gif = 'happy.gif';
        sym = mood === 'overjoyed' ? '★' : '▲';
    } else {
        gif = 'neutral.gif';
        sym = mood === 'content' ? '◆' : '█';
    }
    
    img.src = `art/${gif}`;
    img.onerror = () => {
        img.style.background = '#ffffff';
        img.alt = '[IMG.NOT.FOUND]';
    };
    
    img.style.cursor = 'default';
    img.onclick = null;
    
    mtxt.textContent = mood.toUpperCase();
    if (emoji) emoji.textContent = sym;
    
    if (qel && quote) {
        qel.textContent = quote.toUpperCase();
    }
    
    updbar(info);
    
    document.getElementById('time').textContent = fmttime(info.total).toUpperCase();
    document.getElementById('site').textContent = (info.curr || 'NONE').toUpperCase();
    document.getElementById('count').textContent = info.sites.length;
    
    showsites(info);
}

function updbar(info) {
    const bar = document.getElementById('productivity-bar');
    if (!bar) return;
    
    chrome.storage.local.get(['trackingData'], (d) => {
        const td = d.trackingData || info;
        const cls = td.cls || {};
        const act = td.act || [];
        
        let t1 = 0;
        let t2 = 0;
        let t3 = 0;
        
        act.forEach(s => {
            const c = cls[s.site];
            const lvl = c ? c.level : 2;
            const tm = s.time || 0;
            
            if (lvl === 1) {
                t1 += tm;
            } else if (lvl === 2) {
                t2 += tm;
            } else if (lvl === 3) {
                t3 += tm;
            }
        });
        
        const tot = t1 + t2 + t3;
        
        let p1 = 0;
        let p2 = 0;
        let p3 = 0;
        
        if (tot > 0) {
            p3 = (t3 / tot) * 100;
            p2 = (t2 / tot) * 100;
            p1 = (t1 / tot) * 100;
        } else {
            p1 = 33.33;
            p2 = 33.33;
            p3 = 33.34;
        }
        
        let html = '';
        
        if (p3 > 0) {
            html += `<div class="bar-segment class-3" style="width: ${p3}%"></div>`;
        }
        if (p2 > 0) {
            html += `<div class="bar-segment class-2" style="width: ${p2}%"></div>`;
        }
        if (p1 > 0) {
            html += `<div class="bar-segment class-1" style="width: ${p1}%"></div>`;
        }
        
        bar.innerHTML = html;
    });
}

function showsites(info) {
    const list = document.getElementById('sites-list');
    if (!list) return;
    
    const act = info.act || [];
    
    if (act.length === 0) {
        list.innerHTML = '<div class="dropdown-item"><span class="site-name">NO SITES YET</span></div>';
        return;
    }
    
    const sorted = [...act].sort((a, b) => b.time - a.time);
    
    let html = '';
    sorted.forEach(item => {
        const name = item.site.toUpperCase();
        const time = fmttime(item.time).toUpperCase();
        
        html += `
            <div class="dropdown-item">
                <span class="site-name">${name}</span>
                <span class="site-time">${time}</span>
            </div>
        `;
    });
    
    list.innerHTML = html;
}

function fmttime(s) {
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


