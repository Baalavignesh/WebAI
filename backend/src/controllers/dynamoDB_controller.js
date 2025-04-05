import { docClient } from "../services/awsDynamoDB.js";

const insertTranscriptionDB = async (req, res) => {
  try {
    const { meetingId, transcript } = req.body;

    console.log(`dynamo db transcripts message ${meetingId} and ${transcript} `);

    if (!meetingId || !transcript) {
      return res
        .status(400)
        .json({ error: "Missing meetingId or transcripts" });
    }

    const params = {
      TableName: "TranscriptionStore",
      Item: {
        meetingId,
        transcript,
      },
    };

    await docClient.put(params).promise();
    res.status(200).json({ message: "Transcription inserted successfully" });
  } catch (error) {
    console.error("❌ Error inserting transcription into DynamoDB", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const insertNewMeetingDB = async (meetingID, userNameInfo) => {
  try {
    const params = {
      TableName: "UserInfo",
      Item: {
        meetingId: meetingID,
        userName: userNameInfo,
      },
    };

    await docClient.put(params).promise();
    console.log("Meeting ID inserted successfully");
  } catch (error) {
    console.error("❌ Error inserting transcription into DynamoDB", error);
  }
};

/*const insertNewUserDB = async () => {
  try {
    const { meetingId, transcripts } = req.params();
    const params = {
      TableName: "TranscriptionStore",
      Item: {
        meetingID: meetingId,
        transcript: transcripts,
      },
    };

    await docClient.put(params).promise();
    console.log("✅ Sample transcription inserted");
  } catch (error) {
    console.error("Error in inserting transcription:", error);
  }
};*/

export { insertTranscriptionDB, insertNewMeetingDB };
