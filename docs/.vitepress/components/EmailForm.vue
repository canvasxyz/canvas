<template>
  <div class="EmailForm">
    <form class="EmailFormContainer" @submit.prevent="send">
      <div v-if="submitted" class="EmailFormSuccess">
        Email submitted! We'll be in touch 😁 In the meantime, why not follow us on
        <a href="https://twitter.com/canvas_xyz" target="_blank">
          <strong>Twitter</strong>
        </a>!
      </div>
      <div v-else class="EmailFormInputGroup">
        <input
          class="EmailInput"
          ref="emailRef"
          placeholder="Your Email Address"
          type="email"
        />
        <button
          type="submit"
          class="EmailSubmit"
          :class="{ 'EmailSubmit--loading': sending }"
        >
          {{ sending ? "Submitting" : "Get updates" }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const validateEmail = (email) => {
  return email.match(
    /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
  )
}

const emailRef = ref(null)
const sending = ref(false)
const submitted = ref(false)
const showError = ref(false)
const errorMessage = ref('')

const send = async (e) => {
  sending.value = true
  showError.value = false

  const email = emailRef.value?.value?.trim()

  if (email === "") {
    errorMessage.value = "Please enter an Email Address"
    showError.value = true
  } else if (!validateEmail(email)) {
    errorMessage.value = "Please enter a valid Email Address"
    showError.value = true
  } else {
    try {
      const response = await fetch(
        "https://expressjs-postgres-production-62ae.up.railway.app/",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json;charset=utf-8",
          },
          body: JSON.stringify({ email }),
        }
      )

      await response.json()
      submitted.value = true
    } catch (err) {
      errorMessage.value = "Invalid Email"
      showError.value = true
    }
  }

  sending.value = false
}
</script>

<style scoped>
.EmailForm {
  margin-bottom: 24px;
}

.EmailFormContainer {
  width: 100%;
}

.EmailFormInputGroup {
  display: flex;
  flex-direction: row;
  gap: 12px;
}

.EmailInput {
  font-size: 1rem;
  font-family: var(--vp-font-family-base);
  flex: 1;
  padding: 8px 12px;
  border: 2px solid var(--vp-c-border);
  background: var(--vp-c-bg-soft);
  transition: border-color 0.25s;
}

.EmailInput:focus {
  border-color: var(--vp-c-brand);
  outline: none;
}

.EmailSubmit {
  font-size: 1rem;
  padding: 8px 16px;
  background-color: var(--vp-c-brand-3);
  color: white;
  border: none;
  cursor: pointer;
  border-radius: 4px;
  transition: opacity 0.25s, transform 0.1s;
}

.EmailSubmit:hover {
  opacity: 0.9;
}

.EmailSubmit:active {
  transform: scale(0.96);
}

.EmailSubmit--loading {
  opacity: 0.8;
  cursor: default;
}

.EmailFormSuccess {
  padding: 12px;
  background-color: var(--vp-c-brand);
  color: white;
}

.EmailFormSuccess a {
  color: white;
  text-decoration: underline;
}

@media (max-width: 640px) {
  .EmailFormInputGroup {
    flex-direction: column;
  }
}
</style>