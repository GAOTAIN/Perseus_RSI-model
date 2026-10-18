// Original Perseus runtime settings. File formats follow Live2D/CubismSpecs.
// Run: node work/vtube/sidecars/build_sidecars.js
const fs = require('fs');
const path = require('path');
const root = __dirname;
const rig = JSON.parse(fs.readFileSync(path.join(root, '../rig.json'), 'utf8'));
const parameterMap = new Map(rig.parameters.map(p => [p.id, p]));
const writeJson = (name, value) => {
  fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
  fs.writeFileSync(path.join(root, name), JSON.stringify(value, null, 2) + '\n');
};
const input = (id, type, weight) => ({ Source: { Target: 'Parameter', Id: id }, Weight: weight, Type: type, Reflect: false });
const output = (id, index, scale) => ({ Destination: { Target: 'Parameter', Id: id }, VertexIndex: index, Scale: scale, Weight: 100, Type: 'Angle', Reflect: false });
const vertex = (y, radius, mobility, delay, acceleration) => ({ Position: { X: 0, Y: y }, Mobility: mobility, Delay: delay, Acceleration: acceleration, Radius: radius });
function group(id, name, outputId, options) {
  const { headX, headZ, pos, angle, scale, pendulums } = options;
  let y = 0;
  return {
    setting: {
      Id: id,
      Input: [input('ParamAngleX', 'X', headX), input('ParamBodyAngleX', 'X', 100 - headX), input('ParamAngleZ', 'Angle', headZ), input('ParamBodyAngleZ', 'Angle', 100 - headZ)],
      Output: [output(outputId, pendulums.length, scale)],
      Vertices: [vertex(0, 0, 1, 1, 1), ...pendulums.map(p => vertex(y += p[0], ...p))],
      Normalization: { Position: { Minimum: -pos, Default: 0, Maximum: pos }, Angle: { Minimum: -angle, Default: 0, Maximum: angle } }
    },
    dictionary: { Id: id, Name: name }
  };
}
const groups = [
  group('PhysicsHairFront', '刘海轻微惯性', 'ParamHairFront', { headX: 65, headZ: 80, pos: 4, angle: 8, scale: 0.8, pendulums: [[3.6, 0.7, 0.8, 1.6]] }),
  group('PhysicsHairSide', '左侧发惯性', 'ParamHairSide', { headX: 75, headZ: 75, pos: 4, angle: 10, scale: 1.1, pendulums: [[5, 0.78, 0.95, 1.35], [4, 0.82, 1.1, 1.3]] }),
  group('PhysicsHairSideR', '右侧发延迟惯性', 'ParamHairSideR', { headX: 75, headZ: 75, pos: 4, angle: 10, scale: 1.1, pendulums: [[5.6, 0.8, 1.05, 1.3], [4.6, 0.84, 1.2, 1.25]] }),
  group('PhysicsHairBack', '左银色长发惯性', 'ParamHairBack', { headX: 60, headZ: 65, pos: 5, angle: 9, scale: 1.25, pendulums: [[6, 0.8, 1.05, 1.3], [7, 0.85, 1.2, 1.2]] }),
  group('PhysicsHairBackR', '右银色长发延迟惯性', 'ParamHairBackR', { headX: 60, headZ: 65, pos: 5, angle: 9, scale: 1.25, pendulums: [[6.8, 0.82, 1.15, 1.25], [7.8, 0.86, 1.3, 1.15]] }),
  group('PhysicsCoat', '左裙甲重力惯性', 'ParamCoatSway', { headX: 15, headZ: 15, pos: 3, angle: 5, scale: 0.8, pendulums: [[12, 0.55, 1.8, 2.4]] }),
  group('PhysicsCoatR', '右裙甲重力惯性', 'ParamCoatSwayR', { headX: 15, headZ: 15, pos: 3, angle: 5, scale: 0.8, pendulums: [[12.8, 0.57, 1.95, 2.3]] })
];
const settings = groups.map(g => g.setting);
const physics = {
  Version: 3,
  Meta: {
    PhysicsSettingCount: settings.length,
    TotalInputCount: settings.reduce((n, g) => n + g.Input.length, 0),
    TotalOutputCount: settings.reduce((n, g) => n + g.Output.length, 0),
    VertexCount: settings.reduce((n, g) => n + g.Vertices.length, 0),
    Fps: 60,
    EffectiveForces: { Gravity: { X: 0, Y: -1 }, Wind: { X: 0, Y: 0 } },
    PhysicsDictionary: groups.map(g => g.dictionary)
  },
  PhysicsSettings: settings
};
writeJson('Perseus_RSI.physics3.json', physics);

const duration = 10;
const round = n => Math.round(n * 1e6) / 1e6;
// Cubic Hermite approximation of a sine, using time-restricted Bezier handles.
function sineCurve(id, base, amplitude, cycles, phase = 0) {
  const omega = 2 * Math.PI * cycles / duration;
  const value = t => base + amplitude * Math.sin(omega * t + phase);
  const derivative = t => amplitude * omega * Math.cos(omega * t + phase);
  const segmentCount = Math.max(8, cycles * 8);
  const step = duration / segmentCount;
  const segments = [0, round(value(0))];
  for (let i = 0; i < segmentCount; i++) {
    const t0 = i * step, t1 = (i + 1) * step;
    segments.push(1, round(t0 + step / 3), round(value(t0) + derivative(t0) * step / 3), round(t1 - step / 3), round(value(t1) - derivative(t1) * step / 3), round(t1), round(value(t1)));
  }
  return { Target: 'Parameter', Id: id, FadeInTime: 1.2, FadeOutTime: 1.2, Segments: segments };
}
const curves = [
  sineCurve('ParamBreath', 0.45, 0.35, 2, -Math.PI / 2),
  sineCurve('ParamAngleX', 0, 4.6, 1),
  sineCurve('ParamAngleY', 0, 2.4, 1, Math.PI / 2),
  sineCurve('ParamAngleZ', 0, 1.8, 1, Math.PI),
  sineCurve('ParamBodyAngleX', 0, 1.4, 1, -Math.PI / 4),
  sineCurve('ParamBodyAngleZ', 0, 0.85, 1, Math.PI / 2)
];
const totalSegments = curves.reduce((n, c) => n + (c.Segments.length - 2) / 7, 0);
const motion = {
  Version: 3,
  Meta: { Duration: duration, Fps: 30, Loop: true, AreBeziersRestricted: true, FadeInTime: 1.2, FadeOutTime: 1.2, CurveCount: curves.length, TotalSegmentCount: totalSegments, TotalPointCount: curves.length + 3 * totalSegments, UserDataCount: 0, TotalUserDataSize: 0 },
  Curves: curves,
  UserData: []
};
writeJson('motions/Idle.motion3.json', motion);

function expression(mouth, brow) {
  return {
    Version: 3, Type: 'Live2D Expression', FadeInTime: 0.3, FadeOutTime: 0.35,
    Parameters: [
      { Id: 'ParamMouthForm', Value: mouth, Blend: 'Add' },
      { Id: 'ParamBrowLY', Value: brow, Blend: 'Add' },
      { Id: 'ParamBrowRY', Value: brow, Blend: 'Add' }
    ]
  };
}
const cold = expression(-0.25, -0.12);
const confident = expression(0.50, 0.08);
writeJson('expressions/ColdNoble.exp3.json', cold);
writeJson('expressions/Confident.exp3.json', confident);

const modelMerge = {
  FileReferences: {
    Physics: 'Perseus_RSI.physics3.json',
    Motions: { Idle: [{ File: 'motions/Idle.motion3.json', FadeInTime: 1.2, FadeOutTime: 1.2 }] },
    Expressions: [{ Name: '冷傲', File: 'expressions/ColdNoble.exp3.json' }, { Name: '自信', File: 'expressions/Confident.exp3.json' }]
  },
  Groups: [
    { Target: 'Parameter', Name: 'EyeBlink', Ids: ['ParamEyeLOpen', 'ParamEyeROpen'] },
    { Target: 'Parameter', Name: 'LipSync', Ids: ['ParamMouthOpenY'] }
  ]
};
writeJson('model3-merge.json', modelMerge);

const checks = [];
const assert = (test, label) => { if (!test) throw new Error(label); checks.push(label); };
assert(physics.Meta.PhysicsSettingCount === physics.PhysicsSettings.length, 'physics group count');
assert(physics.Meta.TotalInputCount === 28 && physics.Meta.TotalOutputCount === 7 && physics.Meta.VertexCount === 18, 'physics input/output/vertex counts');
for (const g of physics.PhysicsSettings) {
  assert(g.Vertices.length >= 2 && g.Vertices[0].Radius === 0, g.Id + ' anchored root');
  assert(g.Vertices.slice(1).every(v => v.Radius > 0 && v.Mobility >= 0 && v.Mobility <= 1 && v.Delay > 0 && v.Acceleration > 0), g.Id + ' particle ranges');
  assert(g.Input.every(i => parameterMap.has(i.Source.Id)), g.Id + ' input IDs');
  assert(g.Output.every(o => parameterMap.has(o.Destination.Id) && o.VertexIndex > 0 && o.VertexIndex < g.Vertices.length), g.Id + ' output IDs/vertex indices');
  for (const type of ['X', 'Angle']) assert(g.Input.filter(i => i.Type === type).reduce((n, i) => n + i.Weight, 0) === 100, g.Id + ' ' + type + ' weights');
}
let segments = 0, points = 0;
for (const c of motion.Curves) {
  const p = parameterMap.get(c.Id);
  assert(!!p, c.Id + ' exists');
  let t = c.Segments[0]; points++;
  for (let i = 2; i < c.Segments.length; i += 7) {
    assert(c.Segments[i] === 1, c.Id + ' cubic segment');
    assert(c.Segments[i + 1] > t && c.Segments[i + 3] > c.Segments[i + 1] && c.Segments[i + 5] > c.Segments[i + 3], c.Id + ' monotonic Bezier time');
    t = c.Segments[i + 5]; segments++; points += 3;
    for (const j of [i + 2, i + 4, i + 6]) assert(c.Segments[j] >= p.min && c.Segments[j] <= p.max, c.Id + ' bounded handle');
  }
  assert(t === duration && Math.abs(c.Segments[1] - c.Segments[c.Segments.length - 1]) < 1e-5, c.Id + ' seamless value loop');
}
assert(motion.Meta.TotalSegmentCount === segments && motion.Meta.TotalPointCount === points, 'motion metadata counts');
for (const [name, exp] of [['ColdNoble', cold], ['Confident', confident]]) {
  assert(exp.Parameters.every(p => parameterMap.has(p.Id) && ['Add', 'Multiply', 'Overwrite'].includes(p.Blend)), name + ' parameter IDs/blend modes');
  assert(!exp.Parameters.some(p => p.Id === 'ParamMouthOpenY'), name + ' mouth tracking available');
}
writeJson('validation.json', { status: 'pass', parameterCount: parameterMap.size, physics: { groups: settings.length, inputs: physics.Meta.TotalInputCount, outputs: physics.Meta.TotalOutputCount, vertices: physics.Meta.VertexCount, fps: 60 }, motion: { duration, curves: curves.length, segments, points, loop: true }, expressionCount: 2, checksPassed: checks.length, references: ['https://github.com/Live2D/CubismSpecs/blob/master/FileFormats/physics3.json.md', 'https://github.com/Live2D/CubismSpecs/blob/master/FileFormats/motion3.json.md', 'https://github.com/Live2D/CubismSpecs/blob/master/FileFormats/exp3.json.md'] });
console.log(JSON.stringify({ status: 'pass', directory: root, physicsGroups: settings.length, motionCurves: curves.length, expressions: 2, checksPassed: checks.length }));
