export default async function handler(req, res) {
    // Ambil ID dari URL (contoh: ?id=oasis)
    const { id } = req.query;

    // Ambil URL domain Vercel lu biar dinamis
    const host = req.headers.host;
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    try {
        // Tarik data.json lu sendiri
        const fetchData = await fetch(`${baseUrl}/data.json`);
        const videos = await fetchData.json();

        // Cari video yang ID-nya cocok
        const videoSesuai = videos.find(v => v.id === id);

        if (!videoSesuai) {
            return res.status(404).send('Video tidak ditemukan');
        }

        // Cetak HTML khusus yang dikasih tag Open Graph (OG)
        const htmlString = `
            <!DOCTYPE html>
            <html lang="id">
            <head>
                <meta charset="UTF-8">
                <title>${videoSesuai.title} - WiSpace</title>
                
                <meta property="og:title" content="${videoSesuai.title} | WiSpace">
                <meta property="og:description" content="${videoSesuai.description || 'Tonton konser dan dokumenter musik terbaik cuma di WiSpace!'}">
                <meta property="og:image" content="${videoSesuai.thumbnail}">
                <meta property="og:url" content="${baseUrl}/watch.html?id=${id}">
                <meta property="og:type" content="video.movie">
                <meta name="twitter:card" content="summary_large_image">
                <meta name="twitter:image" content="${videoSesuai.thumbnail}">
                
                <script>
                    window.location.href = "/watch.html?id=${id}";
                </script>
            </head>
            <body style="background-color: #0f0f0f; color: white; text-align: center; padding-top: 50px; font-family: sans-serif;">
                <p>Mengarahkan ke video... Kalau tidak pindah otomatis, <a href="/watch.html?id=${id}" style="color: #24A1DE;">klik di sini</a>.</p>
            </body>
            </html>
        `;

        res.setHeader('Content-Type', 'text/html');
        res.status(200).send(htmlString);

    } catch (error) {
        res.status(500).send('Error membaca data.json');
    }
}