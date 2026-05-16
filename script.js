document.addEventListener('DOMContentLoaded', () => {
    /* =========================================
       DOM ELEMENTS
    ========================================= */
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettingsBtn = document.getElementById('close-settings-btn');

    const themeToggle = document.getElementById('theme-toggle');
    const crossfadeSlider = document.getElementById('crossfade-slider');
    const crossfadeVal = document.getElementById('crossfade-val');
    const explicitToggle = document.getElementById('explicit-toggle');

    const qualityDropdown = document.getElementById('quality-dropdown');
    const qualityHeader = document.getElementById('quality-header');
    const qualityOptions = document.querySelectorAll('#quality-options li');
    const qualitySelectedText = document.getElementById(
        'quality-selected-text',
    );

    /* =========================================
       SETTINGS & LOCAL STORAGE
    ========================================= */
    const defaultSettings = {
        lightMode: false,
        audioQuality: 'high',
        crossfade: 0,
        allowExplicit: true,
        lastPlayedSongId: null,
        lastPlayedTime: 0,
        isLyricsHidden: false,
        repeatState: 0,
        searchHistory: [],
        likedSongs: [], // NEW: Stores your favorite track IDs!
    };

    let appSettings = { ...defaultSettings };

    const savedSettings = localStorage.getItem('vibez_settings');
    if (savedSettings) {
        try {
            const parsedSettings = JSON.parse(savedSettings);
            appSettings = { ...defaultSettings, ...parsedSettings };
            if (
                appSettings.audioQuality !== 'high' &&
                appSettings.audioQuality !== 'normal'
            ) {
                appSettings.audioQuality = 'high';
            }
            // Ensure searchHistory is an array
            if (!Array.isArray(appSettings.searchHistory)) {
                appSettings.searchHistory = [];
            }
        } catch (error) {
            console.error('Local storage corrupted. Resetting to defaults.');
            appSettings = { ...defaultSettings };
        }
    }

    function applySettings() {
        if (themeToggle) themeToggle.checked = appSettings.lightMode;
        if (appSettings.lightMode) document.body.classList.add('light-mode');
        else document.body.classList.remove('light-mode');

        if (qualityOptions && qualitySelectedText) {
            qualityOptions.forEach((opt) => {
                opt.classList.remove('active-option');
                if (
                    opt.getAttribute('data-value') === appSettings.audioQuality
                ) {
                    qualitySelectedText.textContent = opt.textContent;
                    opt.classList.add('active-option');
                }
            });
        }

        if (crossfadeSlider && crossfadeVal) {
            crossfadeSlider.value = appSettings.crossfade;
            crossfadeVal.textContent = appSettings.crossfade + 's';
        }
        if (explicitToggle) explicitToggle.checked = appSettings.allowExplicit;

        const lyricsPanel = document.getElementById('lyrics-panel');
        const lyricsBtn = document.getElementById('btn-lyrics-toggle');
        if (lyricsPanel && lyricsBtn) {
            if (appSettings.isLyricsHidden) {
                lyricsPanel.classList.add('hidden');
                lyricsBtn.classList.remove('active');
            } else {
                lyricsPanel.classList.remove('hidden');
                lyricsBtn.classList.add('active');
            }
        }
    }

    function saveSettings() {
        localStorage.setItem('vibez_settings', JSON.stringify(appSettings));
    }

    window.addEventListener('beforeunload', () => {
        if (audioPlayer && audioPlayer.currentTime > 0) {
            appSettings.lastPlayedTime = audioPlayer.currentTime;
            saveSettings();
        }
    });

    /* =========================================
       LIKED SONGS (FAVORITES) LOGIC
    ========================================= */
    const btnLike = document.getElementById('btn-like');
    const likeIcon = document.getElementById('like-icon');

    // Updates the heart icon visually based on the current track
    function updateLikeUI() {
        if (!btnLike || !likeIcon || !currentAlbumData) return;
        const track = currentAlbumData.tracks[currentTrackIndex];

        if (appSettings.likedSongs.includes(track.id)) {
            // It is liked! Solid icon + colored
            likeIcon.className = 'fa-solid fa-heart icon-sm';
            btnLike.style.color = 'var(--accent-text)';
        } else {
            // Not liked! Outline icon + default color
            likeIcon.className = 'fa-light fa-heart icon-sm';
            btnLike.style.color = '';
        }
    }

    // Toggle the like status when clicked
    if (btnLike) {
        btnLike.addEventListener('click', () => {
            if (!currentAlbumData) return;
            const track = currentAlbumData.tracks[currentTrackIndex];

            // 1. PLAY THE ANIMATION (Reset it first so it plays every click!)
            likeIcon.classList.remove('heart-pop');
            void likeIcon.offsetWidth; // Trigger reflow to restart animation
            likeIcon.classList.add('heart-pop');

            // 2. TOGGLE THE SAVE STATE
            if (appSettings.likedSongs.includes(track.id)) {
                // Remove from favorites
                appSettings.likedSongs = appSettings.likedSongs.filter(
                    (id) => id !== track.id,
                );
            } else {
                // Add to favorites
                appSettings.likedSongs.push(track.id);
            }

            saveSettings();
            updateLikeUI();

            // 3. LIVE UPDATE THE LIBRARY GRID (Updates the "XX songs" counter)
            if (
                document
                    .getElementById('view-library')
                    .classList.contains('active')
            ) {
                renderLibrary(musicData.albums);
            }

            // 4. LIVE UPDATE THE ALBUM PAGE (If looking at the Liked Songs playlist)
            const viewAlbum = document.getElementById('view-album');
            const albumTitle =
                document.getElementById('album-page-title').textContent;

            if (
                viewAlbum.classList.contains('active') &&
                albumTitle === 'Liked Songs'
            ) {
                const updatedLikedAlbum = getLikedSongsAlbum();
                openAlbumPage(updatedLikedAlbum); // Redraws the tracklist instantly!
            }
        });
    }

    // NEW HELPER: Generates a virtual playlist of all liked songs!
    function getLikedSongsAlbum() {
        let likedTracks = [];
        musicData.albums.forEach((album) => {
            album.tracks.forEach((track) => {
                if (appSettings.likedSongs.includes(track.id)) {
                    // We clone the track and attach the parent album's artwork to it!
                    // This way, when playing a mix of songs, the player shows the correct cover art.
                    likedTracks.push({
                        ...track,
                        originalArtwork: album.artwork,
                    });
                }
            });
        });

        return {
            id: 'liked_songs_playlist',
            title: 'Liked Songs',
            artist: 'You',
            type: 'Playlist',
            releaseYear: new Date().getFullYear(),
            artwork: 'linear-gradient(135deg, #450af5, #c4a1ff)',
            primaryColor: '#450af5',
            tracks: likedTracks,
        };
    }

    /* =========================================
       AUDIO ENGINE LOGIC (PLAYBACK & PROGRESS)
    ========================================= */
    const audioPlayer = document.getElementById('main-audio-player');
    const mainPlayPauseBtn = document.querySelector('.btn-play-pause');

    const currentTimeLabel = document.getElementById('current-time');
    const totalTimeLabel = document.getElementById('total-time');
    const playbackContainer = document.getElementById('playback-scrollbar');
    const playbackFill = document.getElementById('playback-fill');

    let isPlaying = false;
    let isDraggingPlayback = false;
    let scrubTime = 0;
    let isBootingUp = true;
    let crossfadeInterval = null;

    let currentAlbumData = null;
    let currentTrackIndex = 0;

    function formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const min = Math.floor(seconds / 60);
        const sec = Math.floor(seconds % 60);
        return `${min}:${sec < 10 ? '0' : ''}${sec}`;
    }

    function togglePlay() {
        if (!audioPlayer.src) return;
        if (isPlaying) {
            audioPlayer.pause();
            if (mainPlayPauseBtn)
                mainPlayPauseBtn.innerHTML =
                    '<i class="fa-solid fa-play"></i>';
        } else {
            audioPlayer.play();
            if (mainPlayPauseBtn)
                mainPlayPauseBtn.innerHTML =
                    '<i class="fa-solid fa-pause"></i>';
        }
        isPlaying = !isPlaying;
    }

    if (mainPlayPauseBtn)
        mainPlayPauseBtn.addEventListener('click', togglePlay);

    audioPlayer.addEventListener('timeupdate', () => {
        if (isDraggingPlayback) return;

        const percent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
        if (playbackFill) playbackFill.style.width = `${percent}%`;
        if (currentTimeLabel)
            currentTimeLabel.textContent = formatTime(audioPlayer.currentTime);

        if (appSettings.crossfade > 0 && audioPlayer.duration) {
            const timeLeft = audioPlayer.duration - audioPlayer.currentTime;
            if (timeLeft <= appSettings.crossfade) {
                let fadeOutVol =
                    currentVolume * (timeLeft / appSettings.crossfade);
                audioPlayer.volume = Math.max(
                    0,
                    Math.min(currentVolume, fadeOutVol),
                );
            } else if (!crossfadeInterval) {
                audioPlayer.volume = currentVolume;
            }
        }
    });

    audioPlayer.addEventListener('loadedmetadata', () => {
        if (totalTimeLabel)
            totalTimeLabel.textContent = formatTime(audioPlayer.duration);
        if (isBootingUp && appSettings.lastPlayedTime > 0) {
            audioPlayer.currentTime = appSettings.lastPlayedTime;
            isBootingUp = false;
        }
    });

    function handlePlaybackDrag(e) {
        if (!playbackContainer || !audioPlayer.duration) return;
        const rect = playbackContainer.getBoundingClientRect();
        let percentage = (e.clientX - rect.left) / rect.width;
        percentage = Math.max(0, Math.min(1, percentage));

        if (playbackFill) playbackFill.style.width = `${percentage * 100}%`;

        scrubTime = percentage * audioPlayer.duration;
        if (currentTimeLabel)
            currentTimeLabel.textContent = formatTime(scrubTime);
    }

    if (playbackContainer) {
        playbackContainer.addEventListener('mousedown', (e) => {
            isDraggingPlayback = true;
            document.body.classList.add('dragging');
            handlePlaybackDrag(e);
        });
    }

    /* =========================================
       SKIP, PREVIOUS & REPEAT LOGIC
    ========================================= */
    const btnNext = document.getElementById('btn-next');
    const btnPrev = document.getElementById('btn-prev');
    const btnRepeat = document.getElementById('btn-repeat');

    function updateRepeatUI() {
        if (!btnRepeat) return;
        if (appSettings.repeatState === 0) {
            btnRepeat.innerHTML = '<i class="fa-light fa-repeat icon-sm"></i>';
            btnRepeat.classList.remove('active');
        } else if (appSettings.repeatState === 1) {
            btnRepeat.innerHTML = '<i class="fa-light fa-repeat icon-sm"></i>';
            btnRepeat.classList.add('active');
        } else {
            btnRepeat.innerHTML =
                '<i class="fa-light fa-repeat-1 icon-sm"></i>';
            btnRepeat.classList.add('active');
        }
    }

    if (btnRepeat) {
        btnRepeat.addEventListener('click', () => {
            appSettings.repeatState = (appSettings.repeatState + 1) % 3;
            saveSettings();
            updateRepeatUI();
        });
    }

    updateRepeatUI();

    function playNext(isAutoPlay = false) {
        if (!currentAlbumData) return;

        if (isAutoPlay && appSettings.repeatState === 2) {
            audioPlayer.currentTime = 0;
            audioPlayer.play();
            return;
        }

        let foundValidTrack = false;
        let startIndex = currentTrackIndex;

        while (!foundValidTrack) {
            currentTrackIndex++;
            if (currentTrackIndex >= currentAlbumData.tracks.length) {
                if (isAutoPlay && appSettings.repeatState === 0) {
                    currentTrackIndex = startIndex;
                    loadTrackIntoPlayer(
                        currentAlbumData.tracks[currentTrackIndex],
                        currentAlbumData,
                    );
                    isPlaying = false;
                    if (mainPlayPauseBtn)
                        mainPlayPauseBtn.innerHTML =
                            '<i class="fa-solid fa-play"></i>';
                    return;
                } else {
                    currentTrackIndex = 0;
                }
            }

            const nextTrack = currentAlbumData.tracks[currentTrackIndex];
            if (appSettings.allowExplicit || !nextTrack.explicit) {
                foundValidTrack = true;
            }

            if (currentTrackIndex === startIndex) break;
        }

        loadTrackIntoPlayer(
            currentAlbumData.tracks[currentTrackIndex],
            currentAlbumData,
        );
        audioPlayer.play();
        isPlaying = true;
        if (mainPlayPauseBtn)
            mainPlayPauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
    }

    function playPrev() {
        if (!currentAlbumData) return;

        if (audioPlayer.currentTime > 3) {
            audioPlayer.currentTime = 0;
            return;
        }

        currentTrackIndex--;
        if (currentTrackIndex < 0) {
            currentTrackIndex = currentAlbumData.tracks.length - 1;
        }

        const prevTrack = currentAlbumData.tracks[currentTrackIndex];
        if (!appSettings.allowExplicit && prevTrack.explicit) {
            playPrev(); // Recursively skip back again if explicit
            return;
        }

        loadTrackIntoPlayer(
            currentAlbumData.tracks[currentTrackIndex],
            currentAlbumData,
        );
        audioPlayer.play();
        isPlaying = true;
        if (mainPlayPauseBtn)
            mainPlayPauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
    }

    if (btnNext) btnNext.addEventListener('click', () => playNext(false));
    if (btnPrev) btnPrev.addEventListener('click', playPrev);

    audioPlayer.addEventListener('ended', () => {
        playNext(true);
    });

    // --- NATIVE OS MEDIA CONTROLS (ACTIONS) ---
    if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', togglePlay);
        navigator.mediaSession.setActionHandler('pause', togglePlay);
        navigator.mediaSession.setActionHandler('previoustrack', playPrev);
        navigator.mediaSession.setActionHandler('nexttrack', () =>
            playNext(false),
        );
    }

    /* =========================================
       JSON DATABASE & DATA BINDING
    ========================================= */
    const recentlyAddedGrid = document.getElementById('recently-added-grid');
    const recentlyPlayedGrid = document.getElementById('recently-played-grid');
    const libraryGrid = document.getElementById('library-grid');

    const npTitle = document.getElementById('now-playing-title');
    const npArtists = document.getElementById('now-playing-artists');
    const npArtwork = document.getElementById('now-playing-artwork');

    let activeAlbumColor = '#222222';

    // Helper: Finds the first non-explicit track in an album (if filter is active)
    function playAlbum(album) {
        let trackIndexToPlay = 0;

        if (!appSettings.allowExplicit) {
            trackIndexToPlay = album.tracks.findIndex((t) => !t.explicit);
            if (trackIndexToPlay === -1) {
                alert(
                    'All tracks in this album contain explicit content, which is currently disabled in your settings.',
                );
                return;
            }
        }

        isBootingUp = false;
        currentAlbumData = album;
        currentTrackIndex = trackIndexToPlay;

        loadTrackIntoPlayer(album.tracks[trackIndexToPlay], album);
        audioPlayer.play();
        isPlaying = true;
        if (mainPlayPauseBtn)
            mainPlayPauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
    }

    function loadMusicDatabase() {
        try {
            const data = musicData;
            renderRecentlyAdded(data.albums);
            renderRecentlyPlayed(data.albums);
            renderLibrary(data.albums);

            if (data.albums.length > 0) {
                let albumToLoad = data.albums[0];
                let trackToLoad = albumToLoad.tracks[0];

                if (appSettings.lastPlayedSongId) {
                    for (const album of data.albums) {
                        const foundTrack = album.tracks.find(
                            (t) => t.id === appSettings.lastPlayedSongId,
                        );
                        if (foundTrack) {
                            albumToLoad = album;
                            trackToLoad = foundTrack;
                            currentAlbumData = album;
                            currentTrackIndex =
                                album.tracks.indexOf(foundTrack);
                            break;
                        }
                    }
                }
                loadTrackIntoPlayer(trackToLoad, albumToLoad);
            }
        } catch (error) {
            console.error('Failed to load database:', error);
        }
    }

    function renderRecentlyPlayed(albums) {
        if (!recentlyPlayedGrid) return;
        recentlyPlayedGrid.innerHTML = '';

        albums.slice(0, 6).forEach((album) => {
            const card = document.createElement('div');
            card.className = 'recent-card';
            card.innerHTML = `
                <div class="recent-art" style="background: ${album.artwork}"></div>
                <div class="recent-info">${album.title}</div>
            `;

            card.addEventListener('mouseenter', () =>
                document.documentElement.style.setProperty(
                    '--album-color',
                    album.primaryColor,
                ),
            );
            card.addEventListener('mouseleave', () =>
                document.documentElement.style.setProperty(
                    '--album-color',
                    activeAlbumColor,
                ),
            );

            card.addEventListener('click', () => playAlbum(album));
            recentlyPlayedGrid.appendChild(card);
        });
    }

    function renderRecentlyAdded(albums) {
        if (!recentlyAddedGrid) return;
        recentlyAddedGrid.innerHTML = '';

        albums.slice(0, 6).forEach((album) => {
            const card = document.createElement('div');
            card.className = 'album-card';
            card.innerHTML = `
                <div class="album-art-container">
                    <div class="album-art" style="background: ${album.artwork}"></div>
                    <button class="card-play-btn"><i class="fa-solid fa-play"></i></button>
                </div>
                <h4>${album.title}</h4>
                <p>${album.type} • ${album.artist}</p>
            `;

            card.addEventListener('mouseenter', () =>
                document.documentElement.style.setProperty(
                    '--album-color',
                    album.primaryColor,
                ),
            );
            card.addEventListener('mouseleave', () =>
                document.documentElement.style.setProperty(
                    '--album-color',
                    activeAlbumColor,
                ),
            );

            const playBtn = card.querySelector('.card-play-btn');
            if (playBtn) {
                playBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    playAlbum(album);
                });
            }

            card.addEventListener('click', () => openAlbumPage(album));
            recentlyAddedGrid.appendChild(card);
        });
    }

    function renderLibrary(albums) {
        const libraryGrid = document.getElementById('library-grid');
        if (!libraryGrid) return;
        libraryGrid.innerHTML = '';

        // --- NEW: ADD THE LIKED SONGS CARD FIRST ---
        const likedAlbumCount = appSettings.likedSongs
            ? appSettings.likedSongs.length
            : 0;
        const likedCard = document.createElement('div');
        likedCard.className = 'album-card';

        likedCard.innerHTML = `
            <div class="album-art-container">
                <div class="album-art" style="background: linear-gradient(135deg, #450af5, #c4a1ff); display:flex; align-items:center; justify-content:center; color:white; font-size:40px;">
                    <i class="fa-solid fa-heart"></i>
                </div>
                <button class="card-play-btn"><i class="fa-solid fa-play"></i></button>
            </div>
            <h4>Liked Songs</h4>
            <p>Playlist • ${likedAlbumCount} songs</p>
        `;

        likedCard.addEventListener('mouseenter', () =>
            document.documentElement.style.setProperty(
                '--album-color',
                '#450af5',
            ),
        );
        likedCard.addEventListener('mouseleave', () =>
            document.documentElement.style.setProperty(
                '--album-color',
                activeAlbumColor,
            ),
        );

        likedCard.addEventListener('click', () => {
            const likedAlbum = getLikedSongsAlbum();
            if (likedAlbum.tracks.length === 0) {
                alert("You haven't liked any songs yet!");
                return;
            }
            openAlbumPage(likedAlbum);
        });

        const likedPlayBtn = likedCard.querySelector('.card-play-btn');
        if (likedPlayBtn) {
            likedPlayBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const likedAlbum = getLikedSongsAlbum();
                if (likedAlbum.tracks.length === 0) {
                    alert("You haven't liked any songs yet!");
                    return;
                }
                playAlbum(likedAlbum);
            });
        }

        libraryGrid.appendChild(likedCard);
        // -------------------------------------------

        // Render the rest of the actual albums
        albums.forEach((album) => {
            const card = document.createElement('div');
            card.className = 'album-card';
            card.innerHTML = `
                <div class="album-art-container">
                    <div class="album-art" style="background: ${album.artwork}"></div>
                    <button class="card-play-btn"><i class="fa-solid fa-play"></i></button>
                </div>
                <h4>${album.title}</h4>
                <p>${album.type} • ${album.artist}</p>
            `;

            card.addEventListener('mouseenter', () =>
                document.documentElement.style.setProperty(
                    '--album-color',
                    album.primaryColor,
                ),
            );
            card.addEventListener('mouseleave', () =>
                document.documentElement.style.setProperty(
                    '--album-color',
                    activeAlbumColor,
                ),
            );

            const playBtn = card.querySelector('.card-play-btn');
            if (playBtn) {
                playBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    playAlbum(album);
                });
            }

            card.addEventListener('click', () => openAlbumPage(album));
            libraryGrid.appendChild(card);
        });
    }

    function openAlbumPage(album) {
        document
            .querySelectorAll('.view-section')
            .forEach((v) => v.classList.remove('active'));
        document.getElementById('view-album').classList.add('active');

        document.documentElement.style.setProperty(
            '--album-color',
            album.primaryColor,
        );
        activeAlbumColor = album.primaryColor;

        document.getElementById('album-page-art').style.background =
            album.artwork;
        document.getElementById('album-page-type').textContent = album.type;
        document.getElementById('album-page-title').textContent = album.title;
        document.getElementById('album-page-meta').textContent =
            `${album.artist} • ${album.releaseYear} • ${album.tracks.length} songs`;

        const tracklistContainer = document.getElementById('album-tracklist');
        tracklistContainer.innerHTML = '';

        album.tracks.forEach((track, index) => {
            const row = document.createElement('div');
            row.className = 'tracklist-row';

            const isBlocked = !appSettings.allowExplicit && track.explicit;

            if (isBlocked) {
                row.style.opacity = '0.4';
                row.style.cursor = 'not-allowed';
                row.title = 'Explicit content disabled.';
            }

            // NEW: If it's a playlist, generate the mini cover art!
            let trackArtHTML = '';
            if (album.type === 'Playlist') {
                // Use the saved original artwork, or fallback to the playlist's artwork
                const artBg = track.originalArtwork || album.artwork;
                trackArtHTML = `<div class="track-list-art" style="background: ${artBg}"></div>`;
            }

            row.innerHTML = `
                <div class="track-num">${index + 1}</div>
                ${trackArtHTML} <!-- INJECTS THE MINI COVER HERE -->
                <div class="track-details">
                    <span class="track-name">${track.title} ${track.explicit ? '<span style="background:var(--text-secondary); color:var(--bg-main); font-size:10px; padding:2px 4px; border-radius:3px; vertical-align:middle; margin-left:4px;">E</span>' : ''}</span>
                    <span>${track.artists.join(', ')}</span>
                </div>
            `;

            if (!isBlocked) {
                row.addEventListener('click', () => {
                    currentAlbumData = album;
                    currentTrackIndex = index;
                    loadTrackIntoPlayer(track, album);
                    audioPlayer.play();
                    isPlaying = true;
                    if (mainPlayPauseBtn)
                        mainPlayPauseBtn.innerHTML =
                            '<i class="fa-solid fa-pause"></i>';
                });
            }

            tracklistContainer.appendChild(row);
        });

        const bigPlayBtn = document.getElementById('album-page-play-btn');
        if (bigPlayBtn) {
            bigPlayBtn.onclick = () => playAlbum(album);
        }
    }

    function loadTrackIntoPlayer(track, album) {
        if (!npTitle || !npArtists || !npArtwork) return;

        npTitle.textContent = track.title;
        npArtwork.style.background = album.artwork;

        activeAlbumColor = album.primaryColor;
        document.documentElement.style.setProperty(
            '--album-color',
            activeAlbumColor,
        );

        let mainArtistsHTML = track.artists
            .map((a) => `<a href="#" class="artist-link">${a}</a>`)
            .join(', ');
        if (track.featuredArtists && track.featuredArtists.length > 0) {
            let featArtistsHTML = track.featuredArtists
                .map((a) => `<a href="#" class="artist-link">${a}</a>`)
                .join(', ');
            npArtists.innerHTML = `${mainArtistsHTML} ft. ${featArtistsHTML}`;
        } else {
            npArtists.innerHTML = mainArtistsHTML;
        }

        let fileToPlay = track.audioFileHigh || track.audioFileNormal;

        if (appSettings.audioQuality === 'normal' && track.audioFileNormal) {
            fileToPlay = track.audioFileNormal;
        } else if (
            appSettings.audioQuality === 'high' &&
            track.audioFileHigh
        ) {
            fileToPlay = track.audioFileHigh;
        }

        if (fileToPlay) {
            audioPlayer.src = fileToPlay;

            if (crossfadeInterval) clearInterval(crossfadeInterval);
            crossfadeInterval = null;

            if (appSettings.crossfade > 0) {
                audioPlayer.volume = 0;
                let targetVol = currentVolume;
                let steps = appSettings.crossfade * 10;
                let currentStep = 0;

                crossfadeInterval = setInterval(() => {
                    currentStep++;
                    let newVol = (currentStep / steps) * targetVol;
                    audioPlayer.volume = Math.max(0, Math.min(1, newVol));

                    if (currentStep >= steps) {
                        clearInterval(crossfadeInterval);
                        crossfadeInterval = null;
                    }
                }, 100);
            } else {
                audioPlayer.volume = currentVolume;
            }
        }

        // NEW: Fix for "Liked Songs" playlist art. Use the original artwork if it exists!
        npArtwork.style.background = track.originalArtwork || album.artwork;
        updateLikeUI(); // Automatically syncs the heart icon!

        appSettings.lastPlayedSongId = track.id;
        saveSettings();

        // --- NATIVE OS MEDIA CONTROLS (METADATA) ---
        if ('mediaSession' in navigator) {
            // Try to extract an image URL from your CSS artwork string (e.g., "url('./assets/cover.jpg')")
            let artUrl = 'https://via.placeholder.com/512'; // Fallback image
            const artMatch = album.artwork.match(/url\(['"]?(.*?)['"]?\)/);
            if (artMatch && artMatch[1]) artUrl = artMatch[1];

            navigator.mediaSession.metadata = new MediaMetadata({
                title: track.title,
                artist: track.artists.join(', '),
                album: album.title,
                artwork: [
                    { src: artUrl, sizes: '512x512', type: 'image/jpeg' },
                    { src: artUrl, sizes: '512x512', type: 'image/png' },
                ],
            });
        }
    }

    /* =========================================
       NAVIGATION LOGIC
    ========================================= */
    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.view-section');

    if (navItems.length > 0) {
        navItems.forEach((item) => {
            item.addEventListener('click', function () {
                const label = this.textContent.trim();
                views.forEach((v) => v.classList.remove('active'));

                if (label === 'Home') {
                    const homeView = document.getElementById('view-home');
                    if (homeView) homeView.classList.add('active');
                } else if (label === 'Search') {
                    const searchView = document.getElementById('view-search');
                    if (searchView) searchView.classList.add('active');
                    // ONLY focus the input, don't force a re-render here!
                    setTimeout(
                        () => document.getElementById('search-input').focus(),
                        100,
                    );
                } else if (label === 'Your Library') {
                    const libView = document.getElementById('view-library');
                    if (libView) libView.classList.add('active');
                }

                document.documentElement.style.setProperty(
                    '--album-color',
                    activeAlbumColor,
                );
            });
        });
    }

    /* =========================================
       VOLUME SLIDER LOGIC
    ========================================= */
    const volumeContainer = document.getElementById('volume-container');
    const volumeFill = document.getElementById('volume-fill');
    const muteBtn = document.getElementById('btn-mute');
    const muteIcon = document.getElementById('mute-icon');

    let isDraggingVolume = false;
    let currentVolume = 0.7;
    let previousVolume = 0.7;

    function updateVolumeUI(percentage) {
        percentage = Math.max(0, Math.min(1, percentage));
        currentVolume = percentage;

        if (volumeFill) volumeFill.style.width = percentage * 100 + '%';
        if (audioPlayer) audioPlayer.volume = percentage;

        if (muteIcon) {
            if (percentage === 0)
                muteIcon.className = 'fa-light fa-volume-xmark icon-sm';
            else if (percentage < 0.5)
                muteIcon.className = 'fa-light fa-volume-low icon-sm';
            else muteIcon.className = 'fa-light fa-volume-high icon-sm';
        }
    }

    function setVolumeFromEvent(e) {
        if (!volumeContainer) return;
        const rect = volumeContainer.getBoundingClientRect();
        const percentage = (e.clientX - rect.left) / rect.width;
        updateVolumeUI(percentage);
    }

    if (volumeContainer) {
        volumeContainer.addEventListener('mousedown', (e) => {
            isDraggingVolume = true;
            document.body.classList.add('dragging');
            setVolumeFromEvent(e);
        });
    }

    if (muteBtn) {
        muteBtn.addEventListener('click', () => {
            if (currentVolume > 0) {
                previousVolume = currentVolume;
                updateVolumeUI(0);
            } else {
                updateVolumeUI(previousVolume > 0 ? previousVolume : 0.7);
            }
        });
    }

    /* =========================================
       GLOBAL MOUSE EVENTS
    ========================================= */
    window.addEventListener('mousemove', (e) => {
        if (isDraggingVolume) setVolumeFromEvent(e);
        if (isDraggingPlayback) handlePlaybackDrag(e);
    });

    window.addEventListener('mouseup', () => {
        if (isDraggingVolume) {
            isDraggingVolume = false;
            document.body.classList.remove('dragging');
        }
        if (isDraggingPlayback) {
            isDraggingPlayback = false;
            document.body.classList.remove('dragging');
            audioPlayer.currentTime = scrubTime;
            appSettings.lastPlayedTime = scrubTime;
        }
    });

    /* =========================================
       SETTINGS EVENTS & INITIALIZATION
    ========================================= */
    if (themeToggle) {
        themeToggle.addEventListener('change', (e) => {
            appSettings.lightMode = e.target.checked;
            applySettings();
            saveSettings();
        });
    }
    if (crossfadeSlider) {
        crossfadeSlider.addEventListener('input', (e) => {
            appSettings.crossfade = e.target.value;
            if (crossfadeVal) crossfadeVal.textContent = e.target.value + 's';
            saveSettings();
        });
    }
    if (explicitToggle) {
        explicitToggle.addEventListener('change', (e) => {
            appSettings.allowExplicit = e.target.checked;
            saveSettings();
            if (
                document
                    .getElementById('view-album')
                    .classList.contains('active') &&
                currentAlbumData
            ) {
                openAlbumPage(currentAlbumData);
            }
        });
    }

    if (qualityHeader) {
        qualityHeader.addEventListener('click', (e) => {
            e.stopPropagation();
            qualityDropdown.classList.toggle('open');
        });
    }
    if (qualityOptions) {
        qualityOptions.forEach((option) => {
            option.addEventListener('click', () => {
                const newQuality = option.getAttribute('data-value');
                if (appSettings.audioQuality !== newQuality) {
                    appSettings.audioQuality = newQuality;
                    applySettings();
                    saveSettings();
                    if (currentAlbumData && audioPlayer.src) {
                        const track =
                            currentAlbumData.tracks[currentTrackIndex];
                        const currentTime = audioPlayer.currentTime;
                        const wasPlaying = isPlaying;

                        let newFile =
                            appSettings.audioQuality === 'normal'
                                ? track.audioFileNormal || track.audioFileHigh
                                : track.audioFileHigh || track.audioFileNormal;

                        audioPlayer.src = newFile;
                        audioPlayer.currentTime = currentTime;

                        if (wasPlaying) {
                            audioPlayer.play();
                        }
                    }
                }
                qualityDropdown.classList.remove('open');
            });
        });
    }
    document.addEventListener('click', () => {
        if (qualityDropdown) qualityDropdown.classList.remove('open');
    });

    if (settingsBtn)
        settingsBtn.addEventListener('click', () =>
            settingsModal.classList.add('active'),
        );
    if (closeSettingsBtn)
        closeSettingsBtn.addEventListener('click', () =>
            settingsModal.classList.remove('active'),
        );
    if (settingsModal) {
        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal)
                settingsModal.classList.remove('active');
        });
    }

    /* =========================================
       LYRICS TOGGLE LOGIC
    ========================================= */
    const lyricsBtn = document.getElementById('btn-lyrics-toggle');
    const lyricsPanel = document.getElementById('lyrics-panel');

    if (lyricsBtn && lyricsPanel) {
        lyricsBtn.addEventListener('click', () => {
            appSettings.isLyricsHidden = !appSettings.isLyricsHidden;
            applySettings();
            saveSettings();
        });
    }

    // FIRE IT UP
    applySettings();
    updateVolumeUI(0.7);
    loadMusicDatabase();

    /* =========================================
       GLOBAL KEYBOARD SHORTCUTS
    ========================================= */
    document.addEventListener('keydown', (e) => {
        // Check if the user is currently typing in an input field (like the search bar)
        const isTyping =
            e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';

        // 1. ALT + S: Instantly open Search (Works even if typing!)
        if (e.altKey && e.code === 'KeyS') {
            e.preventDefault();
            const views = document.querySelectorAll('.view-section');
            views.forEach((v) => v.classList.remove('active'));

            const searchView = document.getElementById('view-search');
            if (searchView) searchView.classList.add('active');

            const searchInput = document.getElementById('search-input');
            if (searchInput) setTimeout(() => searchInput.focus(), 100);
            return;
        }

        // --- ALL SHORTCUTS BELOW ONLY WORK IF NOT TYPING ---
        if (!isTyping) {
            // SPACEBAR: Play / Pause
            if (e.code === 'Space') {
                e.preventDefault();
                togglePlay();
            }

            // 'M' KEY: Toggle Mute
            if (e.code === 'KeyM') {
                e.preventDefault();
                const muteBtn = document.getElementById('btn-mute');
                if (muteBtn) muteBtn.click();
            }

            // 'L' KEY: Like / Unlike current song
            if (e.code === 'KeyL') {
                e.preventDefault();
                const btnLike = document.getElementById('btn-like');
                if (btnLike) btnLike.click();
            }

            // 'Y' KEY: Toggle Lyrics Panel
            if (e.code === 'KeyY') {
                e.preventDefault();
                const lyricsBtn = document.getElementById('btn-lyrics-toggle');
                if (lyricsBtn) lyricsBtn.click();
            }

            // 'R' KEY: Toggle Repeat
            if (e.code === 'KeyR') {
                e.preventDefault();
                const btnRepeat = document.getElementById('btn-repeat');
                if (btnRepeat) btnRepeat.click();
            }

            // UP / DOWN ARROWS: Volume Control (+/- 10%)
            if (e.code === 'ArrowUp') {
                e.preventDefault();
                updateVolumeUI(currentVolume + 0.1);
            }
            if (e.code === 'ArrowDown') {
                e.preventDefault();
                updateVolumeUI(currentVolume - 0.1);
            }

            // LEFT / RIGHT ARROWS: Seek Forward / Backward by 10 seconds
            if (e.code === 'ArrowRight' && !e.ctrlKey) {
                e.preventDefault();
                if (audioPlayer && audioPlayer.src) {
                    audioPlayer.currentTime = Math.min(
                        audioPlayer.currentTime + 10,
                        audioPlayer.duration,
                    );
                }
            }
            if (e.code === 'ArrowLeft' && !e.ctrlKey) {
                e.preventDefault();
                if (audioPlayer && audioPlayer.src) {
                    audioPlayer.currentTime = Math.max(
                        audioPlayer.currentTime - 10,
                        0,
                    );
                }
            }

            // CTRL + LEFT / RIGHT: Skip Track / Previous Track
            if (e.code === 'ArrowRight' && e.ctrlKey) {
                e.preventDefault();
                playNext(false);
            }
            if (e.code === 'ArrowLeft' && e.ctrlKey) {
                e.preventDefault();
                playPrev();
            }
        }
    });

    /* =========================================
       SEARCH LOGIC (With Animation Fix & Typo Tolerance!)
    ========================================= */
    const searchInput = document.getElementById('search-input');
    const searchResultsGrid = document.getElementById('search-results-grid');
    const searchResultsTitle = document.getElementById('search-results-title');
    const bestPickSection = document.getElementById('best-pick-section');
    const bestPickContainer = document.getElementById('best-pick-container');
    const suggestionsDropdown = document.getElementById(
        'search-suggestions-dropdown',
    );
    const suggestionsList = document.getElementById('search-suggestions-list');

    function addToHistory(term) {
        if (!term || term.trim() === '') return;
        if (!appSettings.searchHistory) appSettings.searchHistory = [];
        appSettings.searchHistory = appSettings.searchHistory.filter(
            (h) => h.toLowerCase() !== term.toLowerCase(),
        );
        appSettings.searchHistory.unshift(term);
        if (appSettings.searchHistory.length > 5)
            appSettings.searchHistory.pop();
        saveSettings();
    }

    function getTypoDistance(a, b) {
        if (!a.length) return b.length;
        if (!b.length) return a.length;
        const arr = [];
        for (let i = 0; i <= b.length; i++) {
            arr[i] = [i];
            for (let j = 1; j <= a.length; j++) {
                arr[i][j] =
                    i === 0
                        ? j
                        : Math.min(
                              arr[i - 1][j] + 1,
                              arr[i][j - 1] + 1,
                              arr[i - 1][j - 1] +
                                  (a[j - 1] === b[i - 1] ? 0 : 1),
                          );
            }
        }
        return arr[b.length][a.length];
    }

    // NEW: Added 'animate' parameter!
    function renderSearchResults(albums, query = '', animate = true) {
        if (!searchResultsGrid) return;
        searchResultsGrid.innerHTML = '';
        if (bestPickContainer) bestPickContainer.innerHTML = '';

        if (albums.length === 0) {
            searchResultsTitle.textContent = 'No results found';
            if (bestPickSection) bestPickSection.style.display = 'none';
            return;
        }

        let regularResults = albums;
        let delayCounter = 0;

        if (query.length > 0 && albums.length > 0) {
            searchResultsTitle.textContent = 'Other Results';
            if (bestPickSection) bestPickSection.style.display = 'block';

            const bestPickAlbum = albums[0];
            regularResults = albums.slice(1);

            if (bestPickContainer) {
                const bpCard = document.createElement('div');

                // Only animate if the flag is true
                if (animate) {
                    bpCard.className = 'best-pick-card search-animated';
                    bpCard.style.animationDelay = `${delayCounter * 0.05}s`;
                    delayCounter++;
                } else {
                    bpCard.className = 'best-pick-card';
                }

                bpCard.innerHTML = `
                    <div class="best-pick-art" style="background: ${bestPickAlbum.artwork}"></div>
                    <div class="best-pick-info">
                        <span class="best-pick-badge">Best Pick</span>
                        <h1>${bestPickAlbum.title}</h1>
                        <p style="color: var(--text-secondary); font-weight: bold;">${bestPickAlbum.type} • ${bestPickAlbum.artist}</p>
                    </div>
                    <button class="best-pick-play"><i class="fa-solid fa-play"></i></button>
                `;

                bpCard.addEventListener('mouseenter', () =>
                    document.documentElement.style.setProperty(
                        '--album-color',
                        bestPickAlbum.primaryColor,
                    ),
                );
                bpCard.addEventListener('mouseleave', () =>
                    document.documentElement.style.setProperty(
                        '--album-color',
                        activeAlbumColor,
                    ),
                );

                bpCard
                    .querySelector('.best-pick-play')
                    .addEventListener('click', (e) => {
                        e.stopPropagation();
                        addToHistory(query);
                        playAlbum(bestPickAlbum);
                    });
                bpCard.addEventListener('click', () => {
                    addToHistory(query);
                    openAlbumPage(bestPickAlbum);
                });

                bestPickContainer.appendChild(bpCard);
            }
        } else {
            searchResultsTitle.textContent = 'Browse All';
            if (bestPickSection) bestPickSection.style.display = 'none';
        }

        regularResults.forEach((album) => {
            const card = document.createElement('div');

            // Only animate if the flag is true
            if (animate) {
                card.className = 'album-card search-animated';
                card.style.animationDelay = `${delayCounter * 0.05}s`;
                delayCounter++;
            } else {
                card.className = 'album-card';
            }

            card.innerHTML = `
                <div class="album-art-container">
                    <div class="album-art" style="background: ${album.artwork}"></div>
                    <button class="card-play-btn"><i class="fa-solid fa-play"></i></button>
                </div>
                <h4>${album.title}</h4>
                <p>${album.type} • ${album.artist}</p>
            `;

            card.addEventListener('mouseenter', () =>
                document.documentElement.style.setProperty(
                    '--album-color',
                    album.primaryColor,
                ),
            );
            card.addEventListener('mouseleave', () =>
                document.documentElement.style.setProperty(
                    '--album-color',
                    activeAlbumColor,
                ),
            );

            const playBtn = card.querySelector('.card-play-btn');
            if (playBtn) {
                playBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (query) addToHistory(query);
                    playAlbum(album);
                });
            }
            card.addEventListener('click', () => {
                if (query) addToHistory(query);
                openAlbumPage(album);
            });
            searchResultsGrid.appendChild(card);
        });
    }

    let searchDebounceTimer;
    let lastQuery = '';

    if (searchResultsGrid && musicData) {
        if (searchInput) searchInput.value = ''; // THE FIX: Clear browser's ghost text on refresh
        lastQuery = '';
        renderSearchResults(musicData.albums, '', false); // THE FIX: 'false' disables the load-in animation!
    }

    if (searchInput) {
        function populateHistoryDropdown() {
            suggestionsList.innerHTML =
                '<li class="suggestion-item header">Recent Searches</li>';
            appSettings.searchHistory.forEach((hist) => {
                const li = document.createElement('li');
                li.className = 'suggestion-item';
                li.innerHTML = `<i class="fa-regular fa-clock-rotate-left suggestion-icon"></i> <span>${hist}</span>`;
                li.addEventListener('click', () => {
                    searchInput.value = hist;
                    searchInput.dispatchEvent(new Event('input'));
                    if (suggestionsDropdown)
                        suggestionsDropdown.classList.remove('open');
                });
                suggestionsList.appendChild(li);
            });
            if (suggestionsDropdown) suggestionsDropdown.classList.add('open');
        }

        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchDebounceTimer);
            if (suggestionsDropdown)
                suggestionsDropdown.classList.remove('open');

            searchDebounceTimer = setTimeout(() => {
                const query = e.target.value.toLowerCase().trim();

                if (query === lastQuery) return;
                lastQuery = query;

                if (query === '') {
                    renderSearchResults(musicData.albums, '', false); // No animation when clearing search
                    if (
                        appSettings.searchHistory &&
                        appSettings.searchHistory.length > 0
                    ) {
                        populateHistoryDropdown();
                    }
                    return;
                }

                const scoredAlbums = musicData.albums.map((album) => {
                    let score = 0;
                    const title = album.title.toLowerCase();
                    const artist = album.artist.toLowerCase();

                    if (title.includes(query)) score += 100;
                    if (artist.includes(query)) score += 80;

                    if (query.length >= 3 && score === 0) {
                        const titleWords = title.split(' ');
                        const artistWords = artist.split(' ');
                        const allWords = [...titleWords, ...artistWords];

                        allWords.forEach((word) => {
                            if (word.length >= 3) {
                                const distance = getTypoDistance(query, word);
                                if (distance === 1) score += 40;
                                if (distance === 2) score += 20;
                            }
                        });
                    }
                    return { album, score };
                });

                const finalResults = scoredAlbums
                    .filter((item) => item.score > 0)
                    .sort((a, b) => b.score - a.score)
                    .map((item) => item.album);

                renderSearchResults(finalResults, query, true); // TRUE triggers the animation!

                suggestionsList.innerHTML = '';
                if (finalResults.length > 0) {
                    finalResults.slice(0, 4).forEach((album) => {
                        const li = document.createElement('li');
                        li.className = 'suggestion-item';
                        li.innerHTML = `<i class="fa-light fa-music suggestion-icon"></i> <span>${album.title} • ${album.artist}</span>`;
                        li.addEventListener('click', () => {
                            searchInput.value = album.title;
                            if (suggestionsDropdown)
                                suggestionsDropdown.classList.remove('open');
                            addToHistory(album.title);
                            openAlbumPage(album);
                        });
                        suggestionsList.appendChild(li);
                    });
                    if (suggestionsDropdown)
                        suggestionsDropdown.classList.add('open');
                }
            }, 200);
        });

        searchInput.addEventListener('focus', () => {
            const query = searchInput.value.trim();
            if (
                query === '' &&
                appSettings.searchHistory &&
                appSettings.searchHistory.length > 0
            ) {
                populateHistoryDropdown();
            }
        });

        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const query = searchInput.value.trim();
                if (query) addToHistory(query);
                if (suggestionsDropdown)
                    suggestionsDropdown.classList.remove('open');
            }
        });
    }

    document.addEventListener('click', (e) => {
        if (suggestionsDropdown && searchInput) {
            if (
                !searchInput.contains(e.target) &&
                !suggestionsDropdown.contains(e.target)
            ) {
                suggestionsDropdown.classList.remove('open');
            }
        }
    });
}); // End of DOMContentLoaded
