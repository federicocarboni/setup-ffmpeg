#!/bin/bash

# Check the versions that will be used
linux_version=`curl -L https://johnvansickle.com/ffmpeg/release-readme.txt | grep "version: " | cut -d " " -f 16`
win32_version=`curl -L https://www.gyan.dev/ffmpeg/builds/release-version | cut -d "-" -f 1`

# Make sure that the versions are the same
if [ "$linux_version" != "$win32_version" ]; then
  echo "$linux_version != $win32_version"
  exit 1
fi

linux_url='https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz'
linux_temp_archive='/tmp/ffmpeg-release-amd64-static.tar.xz'
linux_name='ffmpeg-linux-x64'
linux_temp="/tmp/$linux_name"
linux_archive="$linux_name.tar.gz"

win32_url='https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-full.7z'
win32_temp_archive='/tmp/ffmpeg-release-full.7z'
win32_name='ffmpeg-win32-x64'
win32_temp="/tmp/$win32_name"
win32_archive="$win32_name.tar.gz"

# darwin_url=''
# darwin_temp_archive=''
# darwin_name=''
# darwin_temp=''
# darwin_archive=''

download() {
  echo "setup-ffmpeg: downloading $1 to $2"
  curl -L $1 -o $2
}

create_archive() {
  echo "setup-ffmpeg: creating archive $1 from $2"
  curdir=$PWD
  cd $2
  tar -czvf "$curdir/$1" *
  cd $curdir
}

tar_extract() {
  echo "setup-ffmpeg: extracting $2 from $1 to $3"
  tar -xf $1 --wildcards -O $2 > $3
}

remove() {
  echo "setup-ffmpeg: removing $1"
  rm -rf $1
}

create_linux_archive() {
  echo 'setup-ffmpeg: creating linux archive'

  download $linux_url $linux_temp_archive || exit 1

  mkdir $linux_temp || true

  tar_extract $linux_temp_archive '**/ffmpeg' "$linux_temp/ffmpeg" || exit 1
  tar_extract $linux_temp_archive '**/ffprobe' "$linux_temp/ffprobe" || exit 1
  tar_extract $linux_temp_archive '**/GPLv3.txt' "$linux_temp/LICENSE" || exit 1
  tar_extract $linux_temp_archive '**/readme.txt' "$linux_temp/README.txt" || exit 1

  remove $linux_temp_archive

  create_archive $linux_archive $linux_temp || exit 1

  remove $linux_temp

  echo 'setup-ffmpeg: linux archive created successfully'
}

create_win32_archive() {
  echo 'setup-ffmpeg: creating win32 archive'

  download $win32_url $win32_temp_archive || exit 1

  mkdir $win32_temp || true

  7z e $win32_temp_archive "-o$win32_temp" "**/bin/ffmpeg.exe" "**/bin/ffprobe.exe" "**/LICENSE" "**/README.txt" || exit 1

  remove $win32_temp_archive

  create_archive $win32_archive $win32_temp || exit 1

  remove $win32_temp

  echo 'setup-ffmpeg: win32 archive created successfully'
}

create_darwin_archive() {
  echo 'setup-ffmpeg: darwin is not yet supported'
}

create_linux_archive
create_win32_archive
# create_darwin_archive

# Expose the version to the next steps in the workflow
echo "::set-output name=version::$linux_version"
# Expose paths to the archives
echo "::set-output name=linux-path::$linux_archive"
echo "::set-output name=win32-path::$win32_archive"
