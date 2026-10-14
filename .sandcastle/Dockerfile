FROM node:24-bookworm-slim

# Pin uv so tooling changes are explicit when rebuilding the image.
COPY --from=ghcr.io/astral-sh/uv:0.12.20 /uv /uvx /usr/local/bin/

# Install system dependencies and apply current Debian security patches.
RUN apt-get update \
  && apt-get upgrade -y \
  && apt-get install -y --no-install-recommends \
    git \
    curl \
    jq \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Bookworm's apt packages provide Python 3.11; the backend requires 3.12.
# Install outside root's home so the agent can use Python and create venvs.
ENV UV_PYTHON_INSTALL_DIR=/opt/python \
    UV_PYTHON_BIN_DIR=/usr/local/bin
RUN uv python install --default 3.12 && uv cache clean

# Install GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
  | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
  | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
  && apt-get update && apt-get install -y gh \
  && rm -rf /var/lib/apt/lists/*

# Build-args for UID/GID alignment: sandcastle docker build-image
# defaults these to the host user's UID/GID so image-built files
# and bind-mounted files share an owner without runtime chown.
ARG AGENT_UID=1000
ARG AGENT_GID=1000

# Rename the base image's "node" user to "agent" and align UID/GID.
RUN groupmod -o -g $AGENT_GID node && usermod -o -u $AGENT_UID -g $AGENT_GID -d /home/agent -m -l agent node

# Install Codex CLI (run as root before USER agent)
RUN npm install -g @openai/codex

# Match frontend/package.json so agents use the same lockfile and dependency policy.
RUN npm install -g pnpm@12.6.0 \
  && pnpm --version

USER ${AGENT_UID}:${AGENT_GID}

WORKDIR /home/agent

# Pipenv manages the existing Pipfile.lock; uv only supplies the tooling.
ENV PATH="/home/agent/.local/bin:${PATH}"
# Create a container-owned environment outside the mounted host worktree.
ENV PIPENV_IGNORE_VIRTUALENVS=1 \
    PIPENV_VENV_IN_PROJECT=0
RUN uv tool install --python 3.12 pipenv==2026.8.0 \
  && uv cache clean \
  && python --version \
  && python -m venv /tmp/python-smoke-test \
  && rm -rf /tmp/python-smoke-test \
  && pipenv --version

# In worktree sandbox mode, Sandcastle bind-mounts the git worktree at /home/agent/workspace
# and overrides the working directory to /home/agent/workspace at container start.
# Structure your Dockerfile so that /home/agent/workspace can serve as the project root.
ENTRYPOINT ["sleep", "infinity"]
