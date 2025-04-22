<script setup lang="ts">
import { ref } from 'vue'

interface FAQItem {
  question: string
  answer: string
}

defineProps<{
  items: FAQItem[]
}>()

const openItems = ref<Set<number>>(new Set())

function toggleItem(index: number) {
  if (openItems.value.has(index)) {
    openItems.value.delete(index)
  } else {
    openItems.value.add(index)
  }
}

function closeItem(index: number) {
  openItems.value.delete(index)
}
</script>

<template>
  <div class="FAQ">
    <div class="container">
      <div class="faq-items">
        <div
          v-for="(item, index) in items"
          :key="index"
          class="faq-item"
          :class="{ 'open': openItems.has(index) }"
          @click="openItems.has(index) ? closeItem(index) : null"
        >
          <div class="question" @click.stop="toggleItem(index)">
            <h3>{{ item.question }}</h3>
            <div class="toggle">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
          </div>
          <div class="answer" v-show="openItems.has(index)">
            <p v-html="'<p>' + item.answer.replace(/\n/g, '</p><p>') + '</p>'"></p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
.FAQ {
  font-size: 110%;
  margin: 2rem 0;
}

.FAQ .container {
  max-width: 600px;
}

.faq-item {
  margin-bottom: 1rem;
  border-radius: 6px;
  border: 1px solid var(--vp-c-divider);
  overflow: hidden;
  transition: all 0.2s ease;
}

.faq-item.open {
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.05);
}

.question {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem 1rem;
  cursor: pointer;
  user-select: none;
}

.question h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 500;
  color: var(--vp-c-text-1);
}

.toggle {
  flex-shrink: 0;
  margin-left: 1rem;
  color: var(--vp-c-text-2);
  transition: transform 0.2s ease;
}

.faq-item.open .toggle {
  transform: rotate(180deg);
}

.answer {
  padding: 0 1.5rem 1.25rem;
  color: var(--vp-c-text-2);
  font-size: 1rem;
  line-height: 1.6;
}

.answer p {
  margin: 10px 0;
}
</style>