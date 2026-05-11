// database.js
const musicData = {
    albums: [
        {
            id: 'alb_001',
            title: 'Midnight Vibes',
            artist: 'The Synthtones',
            type: 'EP',
            releaseYear: 2024,
            artwork: 'linear-gradient(135deg, #1e2a4a, #3f0bff)',
            primaryColor: '#1e2a4a',
            tracks: [
                {
                    id: 'trk_001',
                    title: 'Neon Horizons',
                    artists: ['The Synthtones'],
                    featuredArtists: ['MC Beat'],
                    explicit: false,
                    audioFileNormal:
                        'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
                    audioFileHigh:
                        'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
                },
                {
                    id: 'trk_001_b',
                    title: 'Cyber City Sleeps',
                    artists: ['The Synthtones'],
                    featuredArtists: [],
                    explicit: false,
                    audioFileNormal:
                        'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
                    audioFileHigh:
                        'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
                },
            ],
        },
        {
            id: 'alb_002',
            title: 'Deep Focus',
            artist: 'Various Artists',
            type: 'Compilation',
            releaseYear: 2023,
            artwork: 'linear-gradient(135deg, #2b1008, #ff5e00)',
            primaryColor: '#2b1008',
            tracks: [
                {
                    id: 'trk_002',
                    title: 'City Sleep',
                    artists: ['DJ Chill'],
                    featuredArtists: [],
                    explicit: true,
                    audioFileNormal:
                        'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
                    audioFileHigh:
                        'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
                },
            ],
        },
    ],
};
