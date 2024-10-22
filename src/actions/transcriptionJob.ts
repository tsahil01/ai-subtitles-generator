"use server";

// const AWS = require('aws-sdk');
import TranscribeService from 'aws-sdk/clients/transcribeservice';

const CLOUDFRONT_URL = process.env.CLOUDFRONT_URL;

const S3_BUCKET = process.env.AWS_BUCKET_NAME;
const transcribeService = new TranscribeService({
  region: `${process.env.AWS_REGION}`,
});

export async function processFile(fileNamePath: string) {
  const user = fileNamePath.split('/')[0];
  const jobName = user + '-' + Date.now();

  const mediaFormat = fileNamePath.split('.').pop();
  const OutputFilePath = fileNamePath.split('/').slice(0, 2).join('-');
  const outputFolder = `transcription-results/${OutputFilePath}/`;

  const params = {
    TranscriptionJobName: jobName,
    LanguageCode: 'en-US',
    MediaFormat: mediaFormat,
    Media: {
      MediaFileUri: `s3://${S3_BUCKET}/${fileNamePath}`,
    },
    OutputBucketName: S3_BUCKET,
    OutputKey: outputFolder + jobName + ".json",

    Settings: {
      ChannelIdentification: false,
      MaxSpeakerLabels: 5,
      ShowAlternatives: false,
      ShowSpeakerLabels: true,
    },
    Subtitles: {
      Formats: ['srt', 'vtt'],
    }
  };

  try {
    await transcribeService.startTranscriptionJob(params).promise();
    console.log(`Started transcription job: ${jobName}`);
    // do db update here

    await checkTranscriptionJob(jobName);
  } catch (error) {
    console.error("Transcription job error:", error);
  }
};

export const checkTranscriptionJob = async (jobName: string) => {
  const params = {
    TranscriptionJobName: jobName,
  };

  while (true) {
    const data = await transcribeService.getTranscriptionJob(params).promise() as any;
    const jobStatus = data.TranscriptionJob.TranscriptionJobStatus;

    console.log(`Transcription job status: ${jobStatus}`);

    if (jobStatus === 'COMPLETED') {
      console.log("Transcription job completed.");

      // Get the transcript file URI
      const transcriptFileUri = data.TranscriptionJob.Transcript.TranscriptFileUri;
      console.log("Transcript file URI:", transcriptFileUri);
      break;
    } else if (jobStatus === 'FAILED') {
      console.error("Transcription job failed:", data.TranscriptionJob.FailureReason);
      break;
    }

    // Wait before checking again (5 seconds interval)
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
};