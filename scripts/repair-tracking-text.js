const pool = require('../config/database');

const PRESETS = {
    pending: {
        title: '\u0110\u01a1n h\u00e0ng \u0111\u00e3 \u0111\u01b0\u1ee3c t\u1ea1o',
        description: 'H\u1ec7 th\u1ed1ng \u0111\u00e3 ghi nh\u1eadn \u0111\u01a1n h\u00e0ng v\u00e0 \u0111ang ch\u1edd x\u00e1c nh\u1eadn.'
    },
    confirmed: {
        title: '\u0110\u01a1n h\u00e0ng \u0111\u00e3 \u0111\u01b0\u1ee3c x\u00e1c nh\u1eadn',
        description: '\u0110\u01a1n h\u00e0ng \u0111\u00e3 \u0111\u01b0\u1ee3c x\u00e1c nh\u1eadn v\u00e0 \u0111ang \u0111\u01b0\u1ee3c chu\u1ea9n b\u1ecb b\u00e0n giao v\u1eadn chuy\u1ec3n.'
    },
    processing: {
        title: '\u0110\u01a1n h\u00e0ng \u0111ang \u0111\u01b0\u1ee3c x\u1eed l\u00fd',
        description: 'Kho h\u00e0ng \u0111ang \u0111\u00f3ng g\u00f3i v\u00e0 chu\u1ea9n b\u1ecb xu\u1ea5t kho.'
    },
    shipping: {
        title: '\u0110\u01a1n h\u00e0ng \u0111ang \u0111\u01b0\u1ee3c giao',
        description: '\u0110\u01a1n h\u00e0ng \u0111\u00e3 r\u1eddi kho v\u00e0 \u0111ang tr\u00ean \u0111\u01b0\u1eddng giao \u0111\u1ebfn ng\u01b0\u1eddi nh\u1eadn.'
    },
    delivered: {
        title: '\u0110\u01a1n h\u00e0ng \u0111\u00e3 giao th\u00e0nh c\u00f4ng',
        description: 'Ng\u01b0\u1eddi nh\u1eadn \u0111\u00e3 nh\u1eadn \u0111\u01b0\u1ee3c \u0111\u01a1n h\u00e0ng.'
    },
    cancelled: {
        title: '\u0110\u01a1n h\u00e0ng \u0111\u00e3 b\u1ecb h\u1ee7y',
        description: '\u0110\u01a1n h\u00e0ng \u0111\u00e3 \u0111\u01b0\u1ee3c h\u1ee7y theo c\u1eadp nh\u1eadt m\u1edbi nh\u1ea5t.'
    }
};

function looksCorrupted(value) {
    const text = String(value || '');

    if (!text) {
        return true;
    }

    return /[?]/.test(text) || /Ã|Ä|Æ|áº|á»|â|�/.test(text);
}

async function repairTrackingText() {
    const [rows] = await pool.execute(
        'SELECT id, status, title, description FROM order_tracking_events ORDER BY id ASC'
    );

    let updated = 0;

    for (const row of rows) {
        const preset = PRESETS[row.status];
        if (!preset) {
            continue;
        }

        if (!looksCorrupted(row.title) && !looksCorrupted(row.description)) {
            continue;
        }

        await pool.execute(
            'UPDATE order_tracking_events SET title = ?, description = ? WHERE id = ?',
            [preset.title, preset.description, row.id]
        );
        updated += 1;
    }

    console.log(JSON.stringify({ updated }, null, 2));
}

repairTrackingText()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });
