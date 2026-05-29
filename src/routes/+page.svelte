<script lang="ts">
  import { onMount } from "svelte";

  let text = $state("");

  let notes = $state<string[]>([""]);
  let active = $state(0);
  let pressTimer: any;

function startPress(i: number) {
  pressTimer = setTimeout(() => {
    deleteNote(i);
  }, 600); // long press threshold
}

function cancelPress() {
  clearTimeout(pressTimer);
}

function deleteNote(i: number) {
  if (notes.length <= 1) return;

  notes.splice(i, 1);

  if (active >= notes.length) {
    active = notes.length - 1;
  }

  text = notes[active] ?? "";
  persist();
}

  function load() {
    if (typeof window === "undefined") return;

    const raw = localStorage.getItem("quicksave");
    if (raw) {
      notes = JSON.parse(raw);
    }
    text = notes[active] ?? "";
  }

  function persist() {
    if (typeof window === "undefined") return;
    localStorage.setItem("quicksave", JSON.stringify(notes));
  }

  function setText(v: string) {
    notes[active] = v;
    text = v;
    persist();
  }

  function newNote() {
    notes = [...notes, ""];
    active = notes.length - 1;
    text = "";
    persist();
  }

  function switchNote(i: number) {
    active = i;
    text = notes[i] ?? "";
  }

  onMount(load);
</script>

<svelte:head>
  <title>Quicksave</title>
</svelte:head>

<main class="wrap">
  <textarea
    class="editor"
    bind:value={text}
    oninput={(e) => setText((e.target as HTMLTextAreaElement).value)}
    placeholder="Start jotting down your thoughts..."
  ></textarea>

  <!-- minimal bottom bar -->
  <div class="bar">
    <div class="notes">
      {#each notes as n, i}
  <button
    class="note {i === active ? 'active' : ''}"
    onclick={() => switchNote(i)}
    onpointerdown={() => startPress(i)}
    onpointerup={cancelPress}
    onpointerleave={cancelPress}
  >
    {n.slice(0, 10) || "new"}
  </button>
{/each}
    </div>

    <button class="plus" onclick={newNote}>+</button>
  </div>
</main>

<style>
  .wrap {
    height: 100vh;
    width: 100vw;
    display: flex;
    flex-direction: column;
    background: white;
  }

  .editor {
    flex: 1;
    width: 100%;
    border: none;
    outline: none;
    resize: none;
    padding: 18px;
    font-size: 16px;
    font-family: monospace;
    line-height: 1.5;
    background: transparent;
  }

  .bar {
    height: 34px;
    display: flex;
    align-items: center;
    border-top: 1px solid #e5e5e5;
    padding: 0 8px;
    background: white;
  }

  .notes {
    flex: 1;
    display: flex;
    gap: 6px;
    overflow-x: auto;
  }

  .note {
    font-size: 11px;
    padding: 2px 6px;
    border: 1px solid #ddd;
    background: transparent;
    cursor: pointer;
    white-space: nowrap;
  }

  .note.active {
    background: black;
    color: white;
  }

  .plus {
    width: 26px;
    height: 26px;
    border: none;
    cursor: pointer;
    background: transparent;
    font-size: 16px;
  }
</style>