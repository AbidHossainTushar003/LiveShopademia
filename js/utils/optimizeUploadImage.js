const supportedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const extensionByImageType = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const maxDimension = 1600;

async function compressToWebp(file) {
    const bitmap = await createImageBitmap(file);
    try {
        const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Your browser could not prepare this image for upload.');
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise((resolve, reject) => {
            canvas.toBlob((result) => result ? resolve(result) : reject(new Error('Your browser could not compress this image.')), 'image/webp', 0.82);
        });
        return blob;
    } finally {
        bitmap.close();
    }
}

export async function optimizeImageFile(file) {
    if (!file || !supportedImageTypes.has(file.type) || typeof createImageBitmap !== 'function') return file;
    const compressed = await compressToWebp(file);
    if (compressed.size >= file.size || !supportedImageTypes.has(compressed.type)) return file;
    const originalName = file.name.replace(/\.[^.]+$/, '');
    return new File([compressed], `${originalName}.${extensionByImageType[compressed.type]}`, { type: compressed.type, lastModified: file.lastModified });
}

export async function optimizedFormData(form) {
    const data = new FormData(form);
    for (const name of new Set([...data.keys()])) {
        const values = data.getAll(name);
        if (typeof File === 'undefined' || !values.some((value) => value instanceof File && value.size > 0)) continue;
        const optimizedValues = await Promise.all(values.map(async (value) =>
            value instanceof File && value.size > 0 ? optimizeImageFile(value) : value
        ));
        data.delete(name);
        for (const value of optimizedValues) {
            if (value instanceof File) data.append(name, value, value.name);
            else data.append(name, value);
        }
    }
    return data;
}
