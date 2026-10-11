cutoff=$(date -d '14 days ago' +%s)

git for-each-ref \
  --merged=refs/remotes/origin/main \
  --format='%(refname:short) %(committerdate:unix) %(upstream:short)' \
  refs/heads |
while read -r branch timestamp upstream; do
  if [[ "$branch" != main && -n "$upstream" && "$timestamp" -lt "$cutoff" ]]; then
    printf '%s\n' "$branch"
    git branch -d -- "$branch"
  fi
done
