from datetime import date, datetime
import math

URGENCY_WINDOW_DAYS = 30
EFFORT_WINDOW_HOURS = 8

DEFAULT_WEIGHTS = {
'urgency': 0.35,
'importance': 0.30,
'effort': 0.15,
'dependency': 0.20
}


STRATEGIES = {
'smart': DEFAULT_WEIGHTS,
'fastest': {**DEFAULT_WEIGHTS, 'effort': 0.5, 'urgency': 0.2, 'importance': 0.1, 'dependency': 0.2},
'high_impact': {**DEFAULT_WEIGHTS, 'importance': 0.6, 'urgency': 0.2, 'effort': 0.05, 'dependency': 0.15},
'deadline': {**DEFAULT_WEIGHTS, 'urgency': 0.6, 'importance': 0.2, 'effort': 0.05, 'dependency': 0.15},
}

def parse_date(d):
    if d is None:
        return None
    if isinstance(d, date):
        return d
    try:
        return datetime.fromisoformat(d).date()
    except Exception:
        return None
    
def detect_cycles(tasks):
    adj = {}
    for t in tasks:
        adj[t['id']] = list(t.get('dependencies') or [])

    visit = {}
    stack = []
    cycle = []

    def dfs(u):
        if visit.get(u) == 1:
            return [u]
        if visit.get(u) == 2:
            return []
        visit[u] = 1
        for v in adj.get(u, []):
            path = dfs(v)
            if path:
                path.append(u)
                return path
        visit[u] = 2
        return []


    for node in adj:
        if visit.get(node) is None:
            path = dfs(node)
        if path:
            cycle.append(list(reversed(path)))
    return cycle

def compute_scores(tasks, strategy='smart'):
    w = STRATEGIES.get(strategy, DEFAULT_WEIGHTS)
    today = date.today()

    incoming = {t['id']: 0 for t in tasks}
    for t in tasks:
        for dep in t.get('dependencies') or []:
            if dep in incoming:
                incoming[dep] += 1
    max_incoming = max(incoming.values()) if incoming else 1
    results = []
    for t in tasks: 
        due = parse_date(t.get('due_date'))
        est = t.get('estimated_hours')
        if est is None or (isinstance(est, (int, float)) and est < 0):
            est = EFFORT_WINDOW_HOURS / 2
        importance = t.get('importance') or 5

        if due is None:
            urgency = 0.0
        else:
            days = (due - today).days
            if days < 0:
                urgency = 1.0 + min(0.5, -days * 0.05)
            else:
                urgency = max(0.0, 1 - days / URGENCY_WINDOW_DAYS)
        urgency = min(1.5, urgency)

        importance_score = max(0.0, min(1.0, importance / 10))

        effort_score = 1 - min(1.0, est / EFFORT_WINDOW_HOURS)

        dep_score = incoming.get(t['id'], 0) / max(1.0, max_incoming)


        combined = (w['urgency'] * urgency +
                    w['importance'] * importance_score +
                    w['effort'] * effort_score +
                    w['dependency'] * dep_score)
        final_score = max(0.0, min(100.0, combined * 100))


        explanation = {
        'urgency': round(urgency, 3),
        'importance': round(importance_score, 3),
        'effort': round(effort_score, 3),
        'dependency': round(dep_score, 3),
        'weights': w
        }


        results.append({**t, 'score': round(final_score, 2), 'explanation': explanation})


# sort descending
    results.sort(key=lambda x: x['score'], reverse=True)
    return results