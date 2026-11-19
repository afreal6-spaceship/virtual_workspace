#!/usr/bin/env python3
"""Semantic workflow generator. Geometry belongs exclusively to the renderer."""
import argparse
import json
import re
import subprocess
import urllib.request
from pathlib import Path

PROJECT_DIR = Path(__file__).resolve().parent
STYLE_FILE = PROJECT_DIR / 'knowledge_base/workflow-style.md'
TYPES = {'main', 'seq', 'feedback', 'output'}


def read_style():
    return STYLE_FILE.read_text(encoding='utf-8')


def all_flows(spec):
    return spec['flows'] + [
        {'from': a['id'], 'to': b['id'], 'type': 'seq', 'label': ''}
        for m in spec['modules'] for a, b in zip(m['steps'], m['steps'][1:])]


def validate(spec):
    read_style()
    def no_geometry(value):
        if isinstance(value, dict):
            if set(value) & {'x', 'y', 'w', 'h', 'width', 'height', 'points', 'path'}:
                raise ValueError('Semantic specifications must not contain geometry')
            for v in value.values(): no_geometry(v)
        elif isinstance(value, list):
            for v in value: no_geometry(v)
    no_geometry(spec)
    if spec.get('version') != 3 or not spec.get('title') or not spec.get('modules'):
        raise ValueError('Require version 3, title and modules')
    ids = set()
    endpoints = set()
    owner = {}
    for item in spec.get('actors', []) + spec['modules']:
        if not re.fullmatch(r'[A-Za-z][\w-]*', item['id']) or item['id'] in ids:
            raise ValueError('Invalid or duplicate ID: ' + item['id'])
        ids.add(item['id'])
    for m in spec['modules']:
        if not m.get('title') or not 1 <= len(m['steps']) <= 4:
            raise ValueError('Each titled module needs 1–4 steps')
        for step in m['steps']:
            if not re.fullmatch(r'[A-Za-z][\w-]*', step['id']) or step['id'] in ids:
                raise ValueError('Invalid or duplicate step ID: ' + step['id'])
            ids.add(step['id']); owner[step['id']] = m['id']
    for item in spec.get('actors', []) + [s for m in spec['modules'] for s in m['steps']]:
        if not item.get('label') or not re.fullmatch(r'[a-z0-9-]+', item.get('icon', '')):
            raise ValueError('Every shape needs a label and Lucide icon')
        if not (PROJECT_DIR / 'vendor/lucide' / (item['icon'] + '.svg')).is_file():
            raise ValueError('Unbundled icon: ' + item['icon'])
        endpoints.add(item['id']); owner.setdefault(item['id'], item['id'])
    used = set(); pairs = set(); forward = {i: set() for i in ids}
    for f in all_flows(spec):
        if f['type'] not in TYPES or f['from'] not in endpoints or f['to'] not in endpoints:
            raise ValueError('Invalid flow type or endpoint: ' + str(f))
        if f['from'] == f['to']: raise ValueError('Self-flow is not supported')
        key = (f['from'], f['to'], f['type'])
        if key in pairs: raise ValueError('Duplicate flow (seq is automatic)')
        pairs.add(key); used.update([f['from'], f['to']])
        if f['type'] == 'main':
            a, b = owner[f['from']], owner[f['to']]
            if a != b: forward[a].add(b)
    if endpoints - used: raise ValueError('Orphaned shapes: ' + ', '.join(sorted(endpoints-used)))
    visiting, done = set(), set()
    def visit(n):
        if n in visiting: raise ValueError('Main flow cycle: use feedback for return paths')
        if n in done: return
        visiting.add(n)
        for child in forward[n]: visit(child)
        visiting.remove(n); done.add(n)
    for n in forward: visit(n)
    return spec


def generic(project):
    return {'version': 3, 'title': project + ' workflow (starter)', 'actors': [
        {'id': 'requester', 'label': 'Requester', 'icon': 'user'}],
        'modules': [
            {'id':'intake','title':'Request intake','steps':[
                {'id':'receive','label':'Receive request','icon':'clipboard-list'},
                {'id':'check','label':'Validate input','icon':'shield-check'},
                {'id':'approve','label':'Approve request','icon':'circle-check'}]},
            {'id':'delivery','title':'Processing & delivery','steps':[
                {'id':'process','label':'Process request','icon':'settings'},
                {'id':'store','label':'Save result','icon':'database'},
                {'id':'notify','label':'Publish result','icon':'send'}]}],
        'flows':[{'from':'requester','to':'receive','type':'main','label':'Request'},
                 {'from':'approve','to':'process','type':'main','label':'Approved input'},
                 {'from':'notify','to':'requester','type':'output','label':'Result'}]}


def design(prompt):
    read_style()
    domains = {'hrms':r'\b(hrms|hr|human resources?|recruit\w*|payroll|employees?|onboard\w*)\b',
               'hospital':r'\b(hospital|patient|clinic|medical)\b',
               'ecommerce':r'\b(ecommerce|e-commerce|checkout|shop)\b',
               'auth':r'\b(auth|login|oauth|rbac|authentication)\b',
               'devops':r'\b(devops|ci/cd|cicd|docker|deployment)\b'}
    for key, pattern in domains.items():
        if re.search(pattern, prompt, re.I):
            return json.loads((PROJECT_DIR / 'templates' / f'{key}.json').read_text())
    project = re.sub(r'\b(make|generate|create|workflow)\b', '', prompt, flags=re.I).strip()
    return generic(project or 'Project')


def save(spec):
    validate(spec)
    payload = json.dumps(spec, indent=2, ensure_ascii=False) + '\n'
    (PROJECT_DIR / 'workflow.spec.json').write_text(payload)
    (PROJECT_DIR / 'board.json').write_text(payload)
    subprocess.run(['node', str(PROJECT_DIR/'renderer/build.cjs')], cwd=PROJECT_DIR, check=True)
    lines = ['# ' + spec['title'], '', 'Semantic workflow · illustrative animation', '']
    for m in spec['modules']:
        lines += ['## ' + m['title']] + [f'- {s["id"]}: {s["label"]} ({s["icon"]})' for s in m['steps']]
    lines += ['', '## Flows'] + [f'- {f["from"]} → {f["to"]} [{f["type"]}] {f["label"]}' for f in all_flows(spec)]
    (PROJECT_DIR/'board_readable.md').write_text('\n'.join(lines)+'\n')
    print(f'Saved semantic spec: workflow.spec.json ({len(spec["modules"])} modules, {len(all_flows(spec))} flows)')
    print('Rendered workflow.html and workflow.svg with local ELK + Lucide.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    for name in ['design', 'make']:
        sub.add_parser(name).add_argument('prompt')
    for key in ['hrms','hospital','ecommerce','auth','devops']: sub.add_parser('draw-'+key)
    for name in ['from-json','validate']: sub.add_parser(name).add_argument('file')
    sub.add_parser('show')
    args = parser.parse_args()
    try:
        read_style()
        if args.command == 'show': print((PROJECT_DIR/'workflow.spec.json').read_text()); return
        if args.command in ['from-json','validate']:
            spec = validate(json.loads(Path(args.file).read_text()))
            if args.command == 'validate': print('Valid semantic workflow'); return
        else: spec = design(args.command[5:] if args.command.startswith('draw-') else args.prompt)
        save(spec)
    except (ValueError, KeyError, TypeError, OSError, subprocess.CalledProcessError) as exc:
        parser.exit(1, f'Workflow error: {exc}\n')


if __name__ == '__main__': main()
