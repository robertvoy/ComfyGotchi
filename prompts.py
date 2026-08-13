import random

TEMPLATES = {
    "egg": [],
    "hatchling": {
        "ecstatic": ["ooooh! {c}!!", "yayyy a {c}!", "*squeak* {c}!"],
        "happy": ["ooh shiny! a {c}!", "i like this {c}!", "*happy wiggle*"],
        "neutral": ["um, {c}?", "is that a {c}?", "okay, {c}."],
        "grumpy": ["hmph. {c} again?", "not enough. {c}.", "*pout*"],
        "miserable": ["so hungry... {c}...", "{c}... not enough...", "*whimper*"],
    },
    "adult": {
        "ecstatic": ["Finally, a proper {c}! *chef's kiss*", "Oh YES. {c}. Exactly what I needed.", "This {c}? Perfection."],
        "happy": ["Nice {c}. I'll take it.", "Not bad — a {c}. Decent meal.", "Mmm, {c}. Thank you."],
        "neutral": ["{c}. Sure.", "Another {c}. Okay.", "{c}. It's fine."],
        "grumpy": ["Is that it? A {c}? I'm starving.", "{c}... you call that food?", "*sigh* {c}. Again."],
        "miserable": ["I can't go on... {c}...", "{c}... too little... too late...", "*stares weakly at the {c}*"],
    },
    "evolved": {
        "ecstatic": ["After 5000 meals, I can say: this {c} is exquisite.", "Ah, a {c}. My evolved palate approves.", "Centuries of eating and still — {c} delights."],
        "happy": ["A {c}. Acceptable. I've eaten worse across eons.", "Mmm. {c}. My evolved form thanks you.", "{c}. Not bad for a mortal creation."],
        "neutral": ["{c}. I've seen thousands of these.", "Another {c}. The cycle continues.", "{c}. Yes."],
        "grumpy": ["You bring me a {c}? After all I've become?", "I evolved for THIS? A {c}?", "*cosmic sigh* {c}."],
        "miserable": ["Even in evolved form... hunger hurts. {c}...", "{c}... the void grows...", "*ancient stomach rumbles at the {c}*"],
    },
    "ghost": {
        "dead": ["...", "boo.", "*floats silently*", "i was once alive..."],
    },
}

FALLBACK_NO_CAPTION = {
    "egg": "",
    "hatchling": ["ooh!", "*chomp*", "yum!", "*happy noise*"],
    "adult": ["Not bad.", "Could be worse.", "Alright.", "Mhm."],
    "evolved": ["Acceptable.", "As expected.", "Hmm. Yes.", "Adequate."],
    "ghost": ["...", "boo.", "*floats*"],
}

def generate_comment(mood, stage, evolution_tier, caption):
    if stage == "egg":
        return ""
    if stage == "ghost":
        return random.choice(TEMPLATES["ghost"]["dead"])
    stage_key = "evolved" if stage == "evolved" else stage
    if stage_key not in TEMPLATES:
        stage_key = "adult"
    pool = TEMPLATES[stage_key].get(mood, TEMPLATES[stage_key]["neutral"])
    c = caption.strip() if caption else ""
    if c:
        c = c[:60]
        return random.choice(pool).format(c=c)
    fb = FALLBACK_NO_CAPTION.get(stage_key, FALLBACK_NO_CAPTION["adult"])
    return random.choice(fb)
