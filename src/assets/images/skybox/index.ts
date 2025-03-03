import mx1 from './1/tycho2t3_80_mx.jpg';
import mx2 from './2/tycho2t3_80_mx.jpg';
import mx3 from './3/tycho2t3_80_mx.jpg';
import mx4 from './4/tycho2t3_80_mx.jpg';
import mx5 from './5/tycho2t3_80_mx.jpg';
import mx6 from './6/tycho2t3_80_mx.jpg';

import my1 from './1/tycho2t3_80_my.jpg';
import my2 from './2/tycho2t3_80_my.jpg';
import my3 from './3/tycho2t3_80_my.jpg';
import my4 from './4/tycho2t3_80_my.jpg';
import my5 from './5/tycho2t3_80_my.jpg';
import my6 from './6/tycho2t3_80_my.jpg';

import mz1 from './1/tycho2t3_80_mz.jpg';
import mz2 from './2/tycho2t3_80_mz.jpg';
import mz3 from './3/tycho2t3_80_mz.jpg';
import mz4 from './4/tycho2t3_80_mz.jpg';
import mz5 from './5/tycho2t3_80_mz.jpg';
import mz6 from './6/tycho2t3_80_mz.jpg';

import px1 from './1/tycho2t3_80_px.jpg';
import px2 from './2/tycho2t3_80_px.jpg';
import px3 from './3/tycho2t3_80_px.jpg';
import px4 from './4/tycho2t3_80_px.jpg';
import px5 from './5/tycho2t3_80_px.jpg';
import px6 from './6/tycho2t3_80_px.jpg';

import py1 from './1/tycho2t3_80_py.jpg';
import py2 from './2/tycho2t3_80_py.jpg';
import py3 from './3/tycho2t3_80_py.jpg';
import py4 from './4/tycho2t3_80_py.jpg';
import py5 from './5/tycho2t3_80_py.jpg';
import py6 from './6/tycho2t3_80_py.jpg';

import pz1 from './1/tycho2t3_80_pz.jpg';
import pz2 from './2/tycho2t3_80_pz.jpg';
import pz3 from './3/tycho2t3_80_pz.jpg';
import pz4 from './4/tycho2t3_80_pz.jpg';
import pz5 from './5/tycho2t3_80_pz.jpg';
import pz6 from './6/tycho2t3_80_pz.jpg';

import rightav9 from './qingtian/rightav9.jpg';
import leftav9 from './qingtian/leftav9.jpg';
import frontav9 from './qingtian/frontav9.jpg';
import backav9 from './qingtian/backav9.jpg';
import topav9 from './qingtian/topav9.jpg';
import bottomav9 from './qingtian/bottomav9.jpg';

import SunSetRight from './wanxia/SunSetRight.png';
import SunSetLeft from './wanxia/SunSetLeft.png';
import SunSetFront from './wanxia/SunSetFront.png';
import SunSetBack from './wanxia/SunSetBack.png';
import SunSetUp from './wanxia/SunSetUp.png';
import SunSetDown from './wanxia/SunSetDown.png';

import Right from './lantian/Right.jpg';
import Left from './lantian/Left.jpg';
import Front from './lantian/Front.jpg';
import Back from './lantian/Back.jpg';
import Up from './lantian/Up.jpg';
import Down from './lantian/Down.jpg';


export const skyboxList = [
    {
        name: "天空盒1",
        id: "skybox1",
        source: {
            negativeX: mx1,
            negativeY: my1,
            negativeZ: mz1,
            positiveX: px1,
            positiveY: py1,
            positiveZ: pz1
        },
    },

    {
        name: "天空盒2",
        id: "skybox2",
        source: {
            negativeX: mx2,
            negativeY: my2,
            negativeZ: mz2,
            positiveX: px2,
            positiveY: py2,
            positiveZ: pz2
        },

    },
    {
        name: "天空盒3",
        id: "skybox3",
        source: {
            negativeX: mx3,
            negativeY: my3,
            negativeZ: mz3,
            positiveX: px3,
            positiveY: py3,
            positiveZ: pz3
        }
    },
    {
        name: "天空盒4",
        id: "skybox4",
        source: {
            negativeX: mx4,
            negativeY: my4,
            negativeZ: mz4,
            positiveX: px4,
            positiveY: py4,
            positiveZ: pz4
        }
    },
    {
        name: "天空盒5",
        id: "skybox5",
        source: {
            negativeX: mx5,
            negativeY: my5,
            negativeZ: mz5,
            positiveX: px5,
            positiveY: py5,
            positiveZ: pz5
        }
    },
    {
        name: "天空盒6",
        id: "skybox6",
        source: {
            negativeX: mx6,
            negativeY: my6,
            negativeZ: mz6,
            positiveX: px6,
            positiveY: py6,
            positiveZ: pz6
        },
    }
]

export const groundSkyboxList = [
    {
        name: "晴天",
        id: "sunny",
        source: {
            positiveX: rightav9,
            negativeX: leftav9,
            positiveY: frontav9,
            negativeY: backav9,
            positiveZ: topav9,
            negativeZ: bottomav9
        }
    },
    {
        name: "晚霞",
        id: "night",
        source: {
            positiveX: SunSetRight,
            negativeX: SunSetLeft,
            positiveY: SunSetFront,
            negativeY: SunSetBack,
            positiveZ: SunSetUp,
            negativeZ: SunSetDown
        }
    },
    {
        name: "云天",
        id: "cloud",
        source: {
            positiveX: Right,
            negativeX: Left,
            positiveY: Front,
            negativeY: Back,
            positiveZ: Up,
            negativeZ: Down
        }
    }
]