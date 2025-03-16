export async function loadBinaryFile(url: string): Promise<Uint8Array> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to load ${url}`);
    let data: ArrayBuffer = await response.arrayBuffer();
    return new Uint8Array(data);
}