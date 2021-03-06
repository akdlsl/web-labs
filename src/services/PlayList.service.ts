import {ISong} from "../models/ISong";
import {Subject, Subscription} from "rxjs";
import {EMode, IPlayer} from "../models/IPlayer";
import {audioService, getBlob} from "./Audio.service";
import {musicApiService} from "./MusicApi.service";

class PlayListService {
    private _songs: ISong[] = [];
    private _activeId: number;
    private _player: IPlayer = {
        volume: 0.5,
        isPlay: false,
        mode: EMode.Standart
    };

    private subscriptions: Subscription[] = [];
    songs$: Subject<ISong[]> = new Subject<ISong[]>();
    activeSong$: Subject<ISong> = new Subject<ISong>();
    player$: Subject<IPlayer> = new Subject<IPlayer>();

    constructor() {
        this.subscriptions.push(audioService.currentTime$.subscribe(currentTime => {
            const song = this.findSongById(this._activeId);
            song.currentTime = currentTime;
            this.updateSong(song);
        }));

        this.subscriptions.push(audioService.endSong$.subscribe(() => {
            this.forward();
        }));

        for (const key in localStorage) {
            if (key.includes('song_')) {
                this.addSong(JSON.parse(localStorage.getItem(key)));
            }
        }

        if (this._songs.length) {
            this.selectSong(this._songs[0].id);
        }
    }

    async loadTopPlaylistByCountry() {
        const response = await musicApiService.getTopByCountry('fr');
        if (!response) {
            return;
        }
        response.radios.forEach(item => {
            this.addSong({
                id: getId(),
                src: item.uri,
                title: item.name,
                currentTime: 0,
                duration: 1,
                imageSrc: item.image_url,
                like: false
            });
        });

        this.songs$.next(this._songs);
    }

    getActiveId() {
        return this._activeId;
    }

    getPlayer(): IPlayer {
        return this._player;
    }

    getSongs(): ISong[] {
        return this._songs;
    }

    findSongById(id: number): ISong | null {
        return this._songs.find(a => a.id === id);
    }

    selectSong(id: number): void {
        const song = this.findSongById(id);
        this._activeId = !!song ? id : -1;
        if (this._player.isPlay) {
            this.play(song.currentTime);
        }
        this.activeSong$.next(song);
    }

    addSongFromFile(file: File | null) {
        if (!file) {
            return;
        }

        const src = getBlob(file);
        if (!src) {
            return
        }

        this.addSong({
            id: getId(),
            src: src,
            title: file.name,
            currentTime: 0,
            duration: 1,
            imageSrc: null,
            like: false
        });

        this.songs$.next(this._songs);
    }

    addSong(song: ISong) {
        if (this._songs.some(a => a.title === song.title)) {
            return false;
        }

        localStorage.setItem('song_' + song.title, JSON.stringify(song));
        this._songs.push(song);
    }

    removeSong(id: number) {
        if (this._activeId === id) {
            this.forward();
        }

        localStorage.removeItem('song_' + this._songs.find(a => a.id === id)?.title);
        this._songs = this._songs.filter(a => a.id !== id);
        this.songs$.next(this._songs);
    }

    updateSong(song: ISong) {
        const index = this._songs.findIndex(a => a.id === song.id);
        this._songs[index] = song;
        this.player$.next(this._player);
        this.activeSong$.next(song);
    }

    play(currentTime = 0) {
        const song = this.findSongById(this._activeId);
        audioService.play(song?.src, currentTime).then(result => {
            this._player.isPlay = true;
            const song = this.findSongById(this._activeId);
            song.currentTime = result.currentTime;
            song.duration = result.duration;
            this.updateSong(song);
        })
    }

    pause() {
        this._player.isPlay = false;
        this.player$.next(this._player);
        audioService.pause(this.findSongById(this._activeId)?.src);
    }

    forward() {
        const idx = this._songs.findIndex(a => a.id === this._activeId);
        const newIdx = idx + 1;

        switch (this._player.mode) {
            case EMode.Standart: this._activeId = this._songs[newIdx >= this._songs.length ? 0 : newIdx].id; break;
            case EMode.Repeat: this._songs[idx].currentTime = 0; break;
            case EMode.Random: const inx = Math.floor(Math.random() * this._songs.length); this._activeId = this._songs[inx].id; break;
        }

        this.selectSong(this._activeId);
    }

    backward() {
        const idx = this._songs.findIndex(a => a.id === this._activeId);
        const newIdx = idx - 1;
        this._activeId = this._songs[newIdx < 0 ? this._songs.length - 1 : newIdx].id;
        this.selectSong(this._activeId);
    }

    setMode(mode: EMode) {
        this._player.mode = mode;
        this.player$.next(this._player);
    }

    setVolume(volume: number) {
        if (volume >= 0 && volume <= 1) {
            this._player.volume = volume;
            audioService.audio.volume = volume;
            this.player$.next(this._player);
        }
    }
}

const getId = (() => {
    let id = 0;
    return () => id++;
})()

export const playListService = new PlayListService();

