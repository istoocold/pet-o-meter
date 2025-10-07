document.addEventListener('DOMContentLoaded', async () => {
    await loaddata();
    
    const sitesrow = document.getElementById('sites-row');
    const dropdown = document.getElementById('sites-dropdown');
    
    if (sitesrow && dropdown) {
        sitesrow.addEventListener('click', () => {
            dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
        });
    }
    
    const infobtn = document.getElementById('info-btn');
    const modal = document.getElementById('modal');
    const closebtn = document.getElementById('close-btn');
    
    infobtn?.addEventListener('click', () => modal.classList.add('show'));
    closebtn?.addEventListener('click', () => modal.classList.remove('show'));
    modal?.addEventListener('click', (ev) => {
        if (ev.target === modal) modal.classList.remove('show');
    });
    
    document.getElementById('github-btn')?.addEventListener('click', () => {
        chrome.tabs.create({ url: 'https://github.com/istoocold/pet-o-meter' });
    });
    
    fetchnews();
    
    setInterval(async () => {
        await loaddata();
    }, 5000);
    
    setInterval(fetchnews, 1800000);
});

let lastmood = null;

async function loaddata() {
    const stored = await chrome.storage.local.get(['trackingData', 'currentMood', 'productivityLevel', 'currentQuote', 'lastQuoteMood']);
    const trackdata = stored.trackingData || {
        total: 0,
        curr: 'None',
        sites: []
    };
    const mood = stored.currentMood || 'neutral';
    const level = stored.productivityLevel || 2;
    let quote = stored.currentQuote || '';
    const lastq = stored.lastQuoteMood || null;
    
    if ((lastq !== mood) || !quote) {
        quote = await generatequote(mood, level);
    }
    
    renderui(trackdata, mood, level, quote);
}

async function fetchnews() {
    const newsel = document.getElementById('news');
    if (!newsel) return;
    
    console.log('[NEWS] Starting news load...');
    
    try {
        const cache = await chrome.storage.local.get(['news', 'newsTime']);
        const now = Date.now();
        
        if (cache.news && cache.newsTime && (now - cache.newsTime) < 60000) {
            console.log('[NEWS] Using cached:', cache.news);
            newsel.textContent = cache.news;
            return;
        }
        
        console.log('[NEWS] Fetching from NewsAPI...');
        newsel.textContent = 'FETCHING NEWS...';
        
        const response = await fetch('https://newsapi.org/v2/top-headlines?category=technology&language=en&pageSize=1&apiKey=d5d0ab2a8941450587bfa64ed5e2a82a');
        
        if (!response.ok) {
            console.error('[NEWS] API failed:', response.status);
            throw new Error('NewsAPI failed');
        }
        
        const data = await response.json();
        console.log('[NEWS] API response:', data);
        
        if (!data.articles || data.articles.length === 0) {
            console.error('[NEWS] No articles');
            throw new Error('No articles');
        }
        
        let headline = data.articles[0].title;
        console.log('[NEWS] Raw headline:', headline);
        
        headline = headline.split(' - ')[0];
        headline = headline.split(' | ')[0];
        headline = headline.split(' Ã¢â‚¬" ')[0];
        headline = headline.replace(/\s+/g, ' ').trim();
        
        console.log('[NEWS] Cleaned headline:', headline);
        
        if (headline.length > 60) {
            headline = headline.substring(0, 57) + '...';
            console.log('[NEWS] Truncated headline:', headline);
        }
        
        headline = headline.toUpperCase();
        console.log('[NEWS] Final headline:', headline);
        
        newsel.textContent = headline;
        await chrome.storage.local.set({ news: headline, newsTime: now });
        
        console.log('[NEWS] Success!');
        
    } catch (err) {
        console.error('[NEWS] Error:', err);
        
        const backups = [
            'AI TRANSFORMS TECH INDUSTRY',
            'QUANTUM COMPUTING BREAKTHROUGH',
            'CYBERSECURITY THREATS EVOLVE',
            'CLOUD COMPUTING GROWTH SURGES',
            'OPEN SOURCE INNOVATION LEADS',
            'MACHINE LEARNING ADVANCES',
            'TECH GIANTS UNVEIL PRODUCTS',
            'BLOCKCHAIN ADOPTION GROWS'
        ];
        
        const backup = backups[Math.floor(Math.random() * backups.length)];
        console.log('[NEWS] Using fallback:', backup);
        newsel.textContent = backup;
        await chrome.storage.local.set({ news: backup, newsTime: Date.now() });
    }
}

async function generatequote(mood, level) {
    const quoteel = document.getElementById('quote');
    if (quoteel) {
        quoteel.textContent = 'THINKING...';
        quoteel.classList.add('loading');
    }
    
    try {
        
        const stored = await chrome.storage.local.get(['trackingData']);
        const trackdata = stored.trackingData || { act: [] };
        
        
        const topsites = [...(trackdata.act || [])]
            .sort((a, b) => b.time - a.time)
            .slice(0, 3)
            .map(s => s.site);
        
        let userprompt = '';
        let context = topsites.length > 0 ? `Top sites visited: ${topsites.join(', ')}. ` : '';
        
        if (level === 1) {
            userprompt = context + 'Generate a short motivational quote (max 12 words) that specifically references the sites they are using. If YouTube, mention videos. If Netflix, mention binge-watching. If social media (Twitter, Instagram, Facebook, TikTok), mention scrolling or feeds. If gaming sites, mention games. Be specific and direct. OUTPUT ONLY THE QUOTE.';
        } else if (level === 2) {
            userprompt = context + 'Generate a short encouraging quote (max 12 words) for someone with medium productivity. If they are on news or info sites, acknowledge that. OUTPUT ONLY THE QUOTE.';
        } else {
            userprompt = context + 'Generate a short celebratory quote (max 12 words) that specifically mentions the productive sites they are using. If GitHub/GitLab, mention coding. If Figma/design tools, mention designing. If docs/learning sites, mention learning. Be specific. OUTPUT ONLY THE QUOTE.';
        }
        
        const response = await fetch('https://ai.hackclub.com/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [
                    {
                        role: 'system',
                        content: 'You are a quote generator for a Chrome extension. The extension is a PROGRAM that can ONLY display text. You MUST respond with ONLY the quote itself - no explanations, no thinking, no extra words. The quote must be 12 words or less. Make quotes SPECIFIC to the websites mentioned - reference the actual activity (watching videos, coding, designing, scrolling feeds, binge-watching shows, gaming, etc). Be direct and relatable. Do NOT use <think> tags or any other formatting. Just output the raw quote text.'
                    },
                    {
                        role: 'user',
                        content: userprompt
                    }
                ]
            })
        });
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        let quotetext = data.choices?.[0]?.message?.content?.trim();
        
        if (quotetext) {
            quotetext = quotetext.replace(/<think>[\s\S]*?<\/think>/gi, '');
            quotetext = quotetext.replace(/<[^>]+>/g, '');
            quotetext = quotetext.replace(/^["']|["']$/g, '');
            quotetext = quotetext.trim();
            
            if (!quotetext || quotetext.length < 3) {
                throw new Error('Quote cleaned to nothing');
            }
            
            if (quotetext.length > 90) {
                quotetext = quotetext.substring(0, 87) + '...';
            }
            
            await chrome.storage.local.set({ 
                currentQuote: quotetext,
                lastQuoteMood: mood
            });
            
            if (quoteel) {
                quoteel.textContent = quotetext.toUpperCase();
                quoteel.classList.remove('loading');
            }
            
            return quotetext;
        } else {
            throw new Error('No quote in response');
        }
        
    } catch (err) {
        const backup = getbackupquote(mood);
        
        await chrome.storage.local.set({ 
            currentQuote: backup,
            lastQuoteMood: mood
        });
        
        if (quoteel) {
            quoteel.textContent = backup;
            quoteel.classList.remove('loading');
        }
        
        return backup;
    }
}

function getbackupquote(mood) {
    const quotes = {
        'sad': 'TIME TO GET BACK TO WORK',
        'grumpy': 'FOCUS. YOU CAN DO BETTER',
        'neutral': 'KEEP GOING. STAY FOCUSED',
        'content': 'GOOD PROGRESS. MAINTAIN PACE',
        'happy': 'EXCELLENT WORK. KEEP IT UP',
        'overjoyed': 'MAXIMUM PRODUCTIVITY ACHIEVED'
    };
    
    return quotes[mood] || 'STAY FOCUSED';
}

function renderui(trackdata, mood, level, quote) {
    const catimg = document.querySelector('.catimg');
    const moodtext = document.getElementById('mood');
    const moodemoji = document.getElementById('emoji');
    const quoteel = document.getElementById('quote');
    
    let gifname = 'neutral.gif';
    let symbol = '█';
    
    if (level === 1 || mood === 'sad' || mood === 'grumpy') {
        gifname = 'sad.gif';
        symbol = mood === 'sad' ? '▼' : '✕';
    } else if (level === 3 || mood === 'happy' || mood === 'overjoyed') {
        gifname = 'happy.gif';
        symbol = mood === 'overjoyed' ? '★' : '▲';
    } else {
        gifname = 'neutral.gif';
        symbol = mood === 'content' ? '◆' : '█';
    }
    
    catimg.src = `art/${gifname}`;
    catimg.onerror = () => {
        catimg.style.background = '#ffffff';
        catimg.alt = '[IMG.NOT.FOUND]';
    };
    
    catimg.style.cursor = 'default';
    catimg.onclick = null;
    
    moodtext.textContent = mood.toUpperCase();
    if (moodemoji) moodemoji.textContent = symbol;
    
    if (quoteel && quote) {
        quoteel.textContent = quote.toUpperCase();
    }
    
    updatebar(trackdata);
    
    document.getElementById('time').textContent = formattime(trackdata.total).toUpperCase();
    document.getElementById('site').textContent = (trackdata.curr || 'NONE').toUpperCase();
    document.getElementById('count').textContent = trackdata.sites.length;
    
    rendersites(trackdata);
}

function updatebar(trackdata) {
    const barcontainer = document.getElementById('productivity-bar');
    if (!barcontainer) return;
    
    chrome.storage.local.get(['trackingData'], (result) => {
        const data = result.trackingData || trackdata;
        const classifications = data.cls || {};
        const activities = data.act || [];
        
        let time1 = 0;
        let time2 = 0;
        let time3 = 0;
        
        activities.forEach(site => {
            const classified = classifications[site.site];
            const lvl = classified ? classified.level : 2;
            const duration = site.time || 0;
            
            if (lvl === 1) {
                time1 += duration;
            } else if (lvl === 2) {
                time2 += duration;
            } else if (lvl === 3) {
                time3 += duration;
            }
        });
        
        const totaltime = time1 + time2 + time3;
        
        let percent1 = 0;
        let percent2 = 0;
        let percent3 = 0;
        
        if (totaltime > 0) {
            percent3 = (time3 / totaltime) * 100;
            percent2 = (time2 / totaltime) * 100;
            percent1 = (time1 / totaltime) * 100;
        } else {
            percent1 = 33.33;
            percent2 = 33.33;
            percent3 = 33.34;
        }
        
        let markup = '';
        
        if (percent3 > 0) {
            markup += `<div class="bar-segment class-3" style="width: ${percent3}%"></div>`;
        }
        if (percent2 > 0) {
            markup += `<div class="bar-segment class-2" style="width: ${percent2}%"></div>`;
        }
        if (percent1 > 0) {
            markup += `<div class="bar-segment class-1" style="width: ${percent1}%"></div>`;
        }
        
        barcontainer.innerHTML = markup;
    });
}

function rendersites(trackdata) {
    const sitelist = document.getElementById('sites-list');
    if (!sitelist) return;
    
    const activities = trackdata.act || [];
    
    if (activities.length === 0) {
        sitelist.innerHTML = '<div class="dropdown-item"><span class="site-name">NO SITES YET</span></div>';
        return;
    }
    
    const sorted = [...activities].sort((a, b) => b.time - a.time);
    
    let markup = '';
    sorted.forEach(item => {
        const hostname = item.site.toUpperCase();
        const duration = formattime(item.time).toUpperCase();
        
        markup += `
            <div class="dropdown-item">
                <span class="site-name">${hostname}</span>
                <span class="site-time">${duration}</span>
            </div>
        `;
    });
    
    sitelist.innerHTML = markup;
}

function formattime(seconds) {
    if (seconds < 60) {
        return seconds + 's';
    } else if (seconds < 3600) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return mins + 'm ' + secs + 's';
    } else {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        return hrs + 'h ' + mins + 'm';
    }
}